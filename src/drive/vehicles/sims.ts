import * as THREE from 'three';
import type { Controls, VehicleKind } from '../state';
import { collide } from '../world/colliders';
import { groundAt, groundNormal, WATER_LEVEL, waveAt } from '../world/map';

/**
 * Vehicle dynamics. Every model is a deliberate arcade simplification of the
 * real thing — enough physics to feel right (weight transfer, grip, lift,
 * stall, rotor spool, buoyancy), none of the stiffness that makes sims hostile
 * to a visitor who just wants to look at a portfolio.
 *
 * Convention: a vehicle's local +Z is forward, +Y up, +X its left side.
 * Yaw 0 faces world +Z; positive steer input turns right (yaw decreases).
 * The origin of every vehicle sits where it touches the ground.
 */

const G = 9.81;
const UP = new THREE.Vector3(0, 1, 0);

const damp = (a: number, b: number, lambda: number, dt: number) => a + (b - a) * (1 - Math.exp(-lambda * dt));
const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);

export type SimEvent = 'crash' | 'drown' | 'bump' | 'land' | 'splash' | null;

export interface SpawnOptions {
  x: number;
  z: number;
  yaw: number;
  y?: number;
  speed?: number;
  airborne?: boolean;
}

export abstract class Sim {
  abstract readonly kind: VehicleKind;
  readonly position = new THREE.Vector3();
  readonly quaternion = new THREE.Quaternion();
  readonly velocity = new THREE.Vector3();
  /** Forward direction for the chase camera. */
  readonly heading = new THREE.Vector3(0, 0, 1);
  /** Signed forward speed, m/s. */
  speed = 0;
  /** 0..1 engine note driver. */
  rpm = 0;
  throttle = 0;
  grounded = true;
  airTime = 0;
  /** Set during step(); consumed (and cleared) by the player. */
  event: SimEvent = null;
  eventStrength = 0;
  /** Seconds left before the sim accepts input after a crash. */
  dead = 0;

  abstract reset(o: SpawnOptions): void;
  abstract step(dt: number, c: Controls, t: number): void;

  protected emit(event: SimEvent, strength = 1) {
    // Crashes outrank bumps within the same frame.
    const rank = { crash: 4, drown: 4, land: 2, splash: 2, bump: 1 } as const;
    if (!event) return;
    if (!this.event || rank[event] >= rank[this.event]) {
      this.event = event;
      this.eventStrength = strength;
    }
  }
}

/* ======================================================= car & motorbike */

interface GroundParams {
  maxSpeed: number;
  boostSpeed: number;
  accel: number;
  brake: number;
  reverseMax: number;
  wheelBase: number;
  maxSteer: number;
  /** Lateral grip, 1/s. */
  grip: number;
  driftGrip: number;
  radius: number;
  height: number;
  wheelRadius: number;
}

export const CAR_PARAMS: GroundParams = {
  maxSpeed: 38,
  boostSpeed: 54,
  accel: 12,
  brake: 28,
  reverseMax: 11,
  wheelBase: 2.62,
  maxSteer: 0.58,
  grip: 8.5,
  driftGrip: 1.3,
  radius: 1.55,
  height: 1.4,
  wheelRadius: 0.36,
};

export const BIKE_PARAMS: GroundParams = {
  maxSpeed: 42,
  boostSpeed: 60,
  accel: 14.5,
  brake: 26,
  reverseMax: 4,
  wheelBase: 1.46,
  maxSteer: 0.46,
  grip: 11,
  driftGrip: 2.2,
  radius: 0.95,
  height: 1.7,
  wheelRadius: 0.32,
};

const _n = { x: 0, y: 1, z: 0 };
const _up = new THREE.Vector3();
const _fwd = new THREE.Vector3();
const _right = new THREE.Vector3();
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _q2 = new THREE.Quaternion();
const _e = new THREE.Euler();

export class GroundSim extends Sim {
  readonly kind: VehicleKind;
  readonly p: GroundParams;
  yaw = 0;
  vy = 0;
  steer = 0;
  /** Smoothed surface normal the chassis aligns to. */
  readonly up = new THREE.Vector3(0, 1, 0);
  /** Suspension / body motion (visual only), radians and metres. */
  bodyPitch = 0;
  bodyPitchV = 0;
  bodyRoll = 0;
  bodyRollV = 0;
  bodyHeave = 0;
  /** Bike only: lean into the corner, and wheelie pitch. */
  lean = 0;
  wheelie = 0;
  wheelSpin = 0;
  /** Lateral slip speed — drives skid marks and tyre squeal. */
  slip = 0;
  braking = false;
  waterDepth = 0;
  private longAccel = 0;
  private wasGrounded = true;

  constructor(kind: 'car' | 'bike') {
    super();
    this.kind = kind;
    this.p = kind === 'car' ? CAR_PARAMS : BIKE_PARAMS;
  }

  reset(o: SpawnOptions) {
    this.yaw = o.yaw;
    const g = groundAt(o.x, o.z);
    this.position.set(o.x, o.y ?? g, o.z);
    const s = o.speed ?? 0;
    this.velocity.set(Math.sin(o.yaw) * s, 0, Math.cos(o.yaw) * s);
    this.vy = 0;
    this.speed = s;
    this.steer = 0;
    this.grounded = this.position.y <= g + 0.05;
    groundNormal(o.x, o.z, this.p.wheelBase / 2, _n);
    this.up.set(_n.x, _n.y, _n.z);
    this.bodyPitch = this.bodyRoll = this.bodyPitchV = this.bodyRollV = 0;
    this.lean = this.wheelie = 0;
    this.wasGrounded = this.grounded;
    this.airTime = 0;
    this.dead = 0;
    this.event = null;
    this.orient(1);
  }

  step(dt: number, c: Controls) {
    const p = this.p;
    const pos = this.position;
    const v = this.velocity;
    const alive = this.dead <= 0;
    if (!alive) this.dead -= dt;
    const cy = alive ? c.y : 0;
    const cx = alive ? c.x : 0;
    const handbrake = alive && c.brake;

    const fx = Math.sin(this.yaw);
    const fz = Math.cos(this.yaw);
    let vf = v.x * fx + v.z * fz;
    const speedRatio = Math.min(1, Math.abs(vf) / p.maxSpeed);

    // Steering: quick at parking speed, calm at speed (as a real rack feels).
    const steerTarget = cx * p.maxSteer * (1 - 0.62 * speedRatio);
    this.steer = damp(this.steer, steerTarget, 9, dt);

    let a = 0;
    this.braking = false;

    if (this.grounded) {
      const top = c.boost && alive ? p.boostSpeed : p.maxSpeed;
      if (cy > 0) {
        if (vf < -0.5) {
          a = p.brake * cy;
          this.braking = true;
        } else {
          const headroom = 1 - Math.pow(clamp(vf / top, 0, 1), 2);
          a = p.accel * cy * headroom * (c.boost ? 1.45 : 1);
        }
      } else if (cy < 0) {
        if (vf > 0.5) {
          a = -p.brake * -cy;
          this.braking = true;
        } else if (vf > -p.reverseMax) {
          a = -p.accel * 0.55 * -cy;
        }
      } else {
        a = -Math.sign(vf) * Math.min(Math.abs(vf) / dt, 2.2); // engine braking
      }
      if (handbrake) {
        a -= Math.sign(vf) * Math.min(Math.abs(vf) / dt, 5.5);
        this.braking = true;
      }

      // Rolling resistance + aero drag.
      a -= Math.sign(vf) * (0.35 + 0.0016 * vf * vf);

      // Gravity along the slope.
      groundNormal(pos.x, pos.z, p.wheelBase / 2, _n);
      a += (G * (_n.x * fx + _n.z * fz)) / Math.max(0.3, _n.y);

      // Wading.
      if (this.waterDepth > 0.25) a -= Math.sign(vf) * this.waterDepth * 6;

      const before = vf;
      vf += a * dt;
      if (this.braking && Math.sign(before) !== Math.sign(vf) && Math.abs(before) > 0.1) vf = 0;

      // Bicycle model yaw rate.
      const yawRate = (-vf * Math.tan(this.steer)) / p.wheelBase * (handbrake ? 1.4 : 1);
      this.yaw += yawRate * dt;

      // Rebuild velocity: longitudinal along the new heading, lateral damped
      // by tyre grip — low grip (handbrake) leaves it sliding: a drift.
      const nfx = Math.sin(this.yaw);
      const nfz = Math.cos(this.yaw);
      const rx = -nfz;
      const rz = nfx;
      const oldLat = v.x * rx + v.z * rz;
      const grip = handbrake ? p.driftGrip : p.grip * (this.kind === 'car' && Math.abs(vf) > 30 ? 0.8 : 1);
      const lat = oldLat * Math.exp(-grip * dt);
      v.x = nfx * vf + rx * lat;
      v.z = nfz * vf + rz * lat;
      this.slip = Math.abs(lat);
      this.longAccel = a;

      const latAccel = vf * yawRate;
      if (this.kind === 'bike') {
        this.lean = damp(this.lean, clamp(-latAccel / G, -0.85, 0.85), 8, dt);
        const wheelieTarget = c.boost && cy > 0 && vf < 22 && vf > 2 ? 0.32 : 0;
        this.wheelie = damp(this.wheelie, wheelieTarget, wheelieTarget > 0 ? 3 : 6, dt);
      }

      // Suspension springs (visual): squat/dive and body roll.
      const kp = 140;
      const cd = 11;
      const pitchTarget = clamp(-a * 0.007, -0.07, 0.07);
      const rollTarget = this.kind === 'car' ? clamp(latAccel * 0.006, -0.07, 0.07) : 0;
      this.bodyPitchV += (kp * (pitchTarget - this.bodyPitch) - cd * this.bodyPitchV) * dt;
      this.bodyRollV += (kp * (rollTarget - this.bodyRoll) - cd * this.bodyRollV) * dt;
    } else {
      // Airborne: a little air control, like every good arcade racer.
      this.yaw += -cx * 1.1 * dt;
      this.slip = 0;
      this.lean = damp(this.lean, 0, 3, dt);
      this.bodyPitchV += (140 * (0 - this.bodyPitch) - 11 * this.bodyPitchV) * dt;
      this.bodyRollV += (140 * (0 - this.bodyRoll) - 11 * this.bodyRollV) * dt;
    }
    this.bodyPitch += this.bodyPitchV * dt;
    this.bodyRoll += this.bodyRollV * dt;

    // Integrate.
    const ox = pos.x;
    const oz = pos.z;
    const oldGround = groundAt(ox, oz);
    pos.x += v.x * dt;
    pos.z += v.z * dt;

    // Walls: a step taller than the suspension can climb.
    const g1 = groundAt(pos.x, pos.z);
    if (g1 - pos.y > 0.75 && g1 > oldGround + 0.4) {
      pos.x = ox;
      pos.z = oz;
      const impact = Math.hypot(v.x, v.z);
      v.x *= -0.25;
      v.z *= -0.25;
      if (impact > 3) this.emit('bump', impact);
    }

    // Obstacles.
    const hit = collide(pos.x, pos.z, pos.y, p.radius, p.height);
    if (hit.hit) {
      pos.x += hit.nx * hit.depth;
      pos.z += hit.nz * hit.depth;
      const vn = v.x * hit.nx + v.z * hit.nz;
      if (vn < 0) {
        v.x -= vn * hit.nx * 1.3;
        v.z -= vn * hit.nz * 1.3;
        if (-vn > 3) this.emit('bump', -vn);
      }
    }

    // Vertical: gravity, then the ground pushes back. Climbing a ramp turns
    // into vertical speed, so leaving its lip is a real jump.
    const ground = groundAt(pos.x, pos.z);
    this.vy -= G * dt;
    pos.y += this.vy * dt;
    if (pos.y <= ground + 0.02) {
      // Rate of climb from the slope *behind* the wheels: a look-ahead sample
      // would see the drop past a ramp's lip and cancel the jump.
      const hs = Math.hypot(v.x, v.z);
      let follow = 0;
      if (hs > 0.5) {
        const back = 0.7;
        const gb = groundAt(pos.x - (v.x / hs) * back, pos.z - (v.z / hs) * back);
        follow = ((ground - gb) / back) * hs;
      }
      if (!this.wasGrounded) {
        const impact = follow - this.vy;
        if (impact > 6) this.emit('land', impact);
        this.bodyPitchV -= impact * 0.05;
        this.bodyHeave = -Math.min(0.25, impact * 0.02);
      }
      pos.y = ground;
      this.vy = clamp(follow, -40, 40);
      this.grounded = true;
      this.airTime = 0;
    } else {
      this.grounded = pos.y < ground + 0.12 && this.vy <= 0.5;
      if (!this.grounded) this.airTime += dt;
    }
    this.wasGrounded = this.grounded;
    this.bodyHeave = damp(this.bodyHeave, 0, 6, dt);

    // Water.
    const depth = WATER_LEVEL - ground;
    if (depth > 0 && this.waterDepth <= 0 && Math.hypot(v.x, v.z) > 4) this.emit('splash', Math.hypot(v.x, v.z));
    this.waterDepth = Math.max(0, depth);
    if (depth > (this.kind === 'car' ? 1.3 : 1.0) && this.dead <= 0) {
      this.emit('drown');
      this.dead = 1.5;
    }

    this.speed = v.x * Math.sin(this.yaw) + v.z * Math.cos(this.yaw);
    this.wheelSpin += (this.speed / p.wheelRadius) * dt;
    this.throttle = Math.max(0, cy);
    const gear = Math.abs(this.speed) / (p.boostSpeed / 5);
    const inGear = gear - Math.floor(gear);
    this.rpm = damp(this.rpm, this.grounded ? 0.18 + 0.75 * (Math.floor(gear) === 0 ? gear : 0.35 + inGear * 0.65) : 0.95 * this.throttle + 0.2, 8, dt);

    this.orient(dt);
  }

  private orient(dt: number) {
    if (this.grounded) {
      groundNormal(this.position.x, this.position.z, this.p.wheelBase / 2, _n);
      _up.set(_n.x, _n.y, _n.z);
    } else {
      // Nose follows the arc of the jump.
      _up.set(0, 1, 0);
    }
    this.up.lerp(_up, 1 - Math.exp(-14 * dt)).normalize();

    _fwd.set(Math.sin(this.yaw), 0, Math.cos(this.yaw));
    if (!this.grounded) {
      const horiz = Math.max(4, Math.hypot(this.velocity.x, this.velocity.z));
      _fwd.y = clamp(this.vy / horiz, -0.6, 0.6) * 0.6;
      _fwd.normalize();
    }
    // Gram–Schmidt: forward perpendicular to up.
    _fwd.addScaledVector(this.up, -_fwd.dot(this.up)).normalize();
    _right.crossVectors(this.up, _fwd).normalize();
    _m.makeBasis(_right, this.up, _fwd);
    this.quaternion.setFromRotationMatrix(_m);
    this.heading.set(Math.sin(this.yaw), 0, Math.cos(this.yaw));
  }
}

/* ================================================================= plane */

const PLANE = {
  // Thrust below 1 g: a steep climb bleeds speed until the wing stalls.
  thrust: 9.2,
  drag: 0.0026,
  stall: 22,
  rotate: 25,
  pitchRate: 0.95,
  rollRate: 2.4,
  radius: 4.2,
};

export class PlaneSim extends Sim {
  readonly kind = 'plane' as const;
  sink = 0;
  prop = 0;
  /** Control surface deflections, -1..1 (visual). */
  aileron = 0;
  elevator = 0;
  rudder = 0;
  bank = 0;
  pitch = 0;
  private yawG = 0;
  private pitchG = 0;
  private readonly fwd = new THREE.Vector3();

  reset(o: SpawnOptions) {
    const g = Math.max(groundAt(o.x, o.z), WATER_LEVEL);
    this.position.set(o.x, o.y ?? g, o.z);
    this.speed = o.speed ?? 0;
    this.grounded = !o.airborne;
    this.throttle = o.airborne ? 0.75 : 0;
    this.sink = 0;
    this.yawG = o.yaw;
    this.pitchG = 0;
    this.quaternion.setFromEuler(_e.set(0, o.yaw, 0, 'YXZ'));
    this.airTime = 0;
    this.dead = 0;
    this.event = null;
    this.updateDerived();
  }

  private updateDerived() {
    this.fwd.set(0, 0, 1).applyQuaternion(this.quaternion);
    _right.set(-1, 0, 0).applyQuaternion(this.quaternion);
    _up.set(0, 1, 0).applyQuaternion(this.quaternion);
    this.bank = Math.atan2(-_right.y, _up.y);
    this.pitch = Math.asin(clamp(this.fwd.y, -1, 1));
    this.heading.copy(this.fwd);
  }

  step(dt: number, c: Controls) {
    if (this.dead > 0) {
      this.dead -= dt;
      this.speed = damp(this.speed, 0, 3, dt);
      return;
    }

    const pos = this.position;
    this.aileron = damp(this.aileron, c.x, 10, dt);
    this.elevator = damp(this.elevator, c.y, 10, dt);

    if (this.grounded) {
      // ---- Taxi & take-off roll ----
      this.throttle = damp(this.throttle, c.y > 0 ? (c.boost ? 1 : 0.9) : 0, 2, dt);
      // Wheel friction and a heavier airframe on the ground: a believable take-off roll.
      let a = PLANE.thrust * 0.85 * this.throttle * (c.boost ? 1.4 : 1) - PLANE.drag * this.speed * this.speed - 0.4;
      if (c.y < 0 || c.brake) a -= 9;
      this.speed = Math.max(0, this.speed + a * dt);

      const steerRate = 0.7 * clamp(this.speed / 6, 0.35, 1) * (1 - clamp((this.speed - 20) / 20, 0, 0.8));
      this.rudder = damp(this.rudder, c.x, 8, dt);
      this.yawG += -c.x * steerRate * dt;

      // Rotation: pull back once you're fast enough.
      const canRotate = this.speed > PLANE.rotate;
      const pitchTarget = canRotate && c.y > 0 ? 0.16 : 0;
      this.pitchG = damp(this.pitchG, pitchTarget, canRotate ? 1.6 : 6, dt);
      this.quaternion.setFromEuler(_e.set(-this.pitchG, this.yawG, 0, 'YXZ'));
      this.updateDerived();

      const lift = clamp((this.speed - PLANE.stall) / 8, 0, 1);
      pos.x += this.fwd.x * this.speed * dt;
      pos.z += this.fwd.z * this.speed * dt;
      const ground = Math.max(groundAt(pos.x, pos.z), WATER_LEVEL);
      if (lift > 0 && this.pitchG > 0.08) {
        pos.y = Math.max(ground, pos.y + this.fwd.y * this.speed * dt * lift);
        if (pos.y > ground + 0.3) {
          this.grounded = false;
          this.sink = 0;
        }
      } else {
        pos.y = ground;
      }
      if (ground <= WATER_LEVEL + 0.01 && groundAt(pos.x, pos.z) < WATER_LEVEL - 0.3) this.crash('drown');
    } else {
      // ---- Flight ----
      const control = clamp(this.speed / PLANE.stall, 0.25, 1.3);
      const throttleTarget = c.boost ? 1 : c.brake ? 0.1 : 0.72;
      this.throttle = damp(this.throttle, throttleTarget, 1.5, dt);

      let rollIn = c.x * PLANE.rollRate * control;
      // Gentle auto-level so a casual visitor never ends up upside down.
      if (Math.abs(c.x) < 0.05) rollIn = -this.bank * 1.3;
      const pitchIn = c.y * PLANE.pitchRate * control;

      _q.setFromAxisAngle(_right.set(1, 0, 0), -pitchIn * dt);
      _q2.setFromAxisAngle(_fwd.set(0, 0, 1), rollIn * dt);
      this.quaternion.multiply(_q).multiply(_q2);

      // Coordinated turn: bank becomes heading change.
      this.updateDerived();
      const turn = clamp((-G * Math.tan(clamp(this.bank, -1.3, 1.3))) / Math.max(15, this.speed), -1.2, 1.2);
      _q.setFromAxisAngle(UP, turn * dt * Math.cos(this.pitch));
      this.quaternion.premultiply(_q).normalize();

      // Stall: below flying speed the nose drops.
      if (this.speed < PLANE.stall) {
        const stall = 1 - this.speed / PLANE.stall;
        _q.setFromAxisAngle(_right.set(1, 0, 0), stall * 1.4 * dt * Math.max(0, Math.cos(this.bank)));
        this.quaternion.multiply(_q);
      }
      this.updateDerived();
      this.rudder = damp(this.rudder, c.x * 0.3, 6, dt);

      // Energy: thrust, drag, and trading speed for height.
      const brakeDrag = c.brake ? 0.006 : 0;
      const a =
        PLANE.thrust * this.throttle * (c.boost ? 1.55 : 1) -
        (PLANE.drag + brakeDrag) * this.speed * this.speed -
        G * this.fwd.y;
      this.speed = clamp(this.speed + a * dt, 0, 110);

      const liftDeficit = 1 - clamp(this.speed / PLANE.stall, 0, 1);
      this.sink = damp(this.sink, liftDeficit * liftDeficit * 16, 2, dt);

      pos.addScaledVector(this.fwd, this.speed * dt);
      pos.y -= this.sink * dt;
      this.airTime += dt;

      // Touchdown or crash.
      const ground = Math.max(groundAt(pos.x, pos.z), WATER_LEVEL);
      if (pos.y <= ground) {
        const vs = this.fwd.y * this.speed - this.sink;
        const onWater = groundAt(pos.x, pos.z) < WATER_LEVEL;
        if (onWater || vs < -7 || Math.abs(this.bank) > 0.45 || this.pitch < -0.22) {
          pos.y = ground;
          this.crash(onWater ? 'drown' : 'crash');
        } else {
          pos.y = ground;
          this.grounded = true;
          this.airTime = 0;
          const e = new THREE.Euler().setFromQuaternion(this.quaternion, 'YXZ');
          this.yawG = e.y;
          this.pitchG = Math.max(0, -e.x);
          this.emit('land', -vs);
        }
      }
      if (pos.y > 650) pos.y = 650;
    }

    // Buildings, trees and the lighthouse.
    const hit = collide(pos.x, pos.z, pos.y, PLANE.radius, 2.6);
    if (hit.hit) {
      if (this.speed > 14) this.crash('crash');
      else {
        pos.x += hit.nx * hit.depth;
        pos.z += hit.nz * hit.depth;
        this.speed *= 0.3;
      }
    }

    this.velocity.copy(this.fwd).multiplyScalar(this.speed);
    this.velocity.y -= this.sink;
    this.prop += (8 + this.throttle * 60) * dt;
    this.rpm = damp(this.rpm, 0.15 + this.throttle * 0.75 + (c.boost ? 0.1 : 0), 4, dt);
  }

  private crash(kind: 'crash' | 'drown') {
    this.emit(kind);
    this.dead = 1.4;
    this.speed = 0;
    this.sink = 0;
  }
}

/* ============================================================ helicopter */

export class HeliSim extends Sim {
  readonly kind = 'heli' as const;
  yaw = 0;
  /** 0..1 rotor spool. */
  spool = 0;
  rotor = 0;
  tailRotor = 0;
  tiltPitch = 0;
  tiltRoll = 0;
  private yawRate = 0;
  private readonly vLocal = new THREE.Vector2();

  reset(o: SpawnOptions) {
    const g = Math.max(groundAt(o.x, o.z), WATER_LEVEL);
    this.position.set(o.x, Math.max(g, o.y ?? g), o.z);
    this.yaw = o.yaw;
    this.velocity.set(0, 0, 0);
    this.grounded = this.position.y <= g + 0.05;
    this.spool = this.grounded ? 0 : 1;
    this.tiltPitch = this.tiltRoll = 0;
    this.yawRate = 0;
    this.dead = 0;
    this.event = null;
    this.orient();
  }

  step(dt: number, c: Controls) {
    const pos = this.position;
    const v = this.velocity;

    // The turbine needs a moment before the rotor can lift anything.
    const wantsPower = c.lift > 0 || !this.grounded || Math.abs(c.y) > 0 || Math.abs(c.x) > 0;
    this.spool = clamp(this.spool + (wantsPower ? 0.45 : -0.15) * dt, 0, 1);
    const power = clamp((this.spool - 0.55) / 0.45, 0, 1);

    const fx = Math.sin(this.yaw);
    const fz = Math.cos(this.yaw);
    const rx = -fz;
    const rz = fx;

    // Cyclic: forward/back in the heading frame. Inertia keeps it floaty.
    const top = c.boost ? 48 : 32;
    const targetF = c.y * top * power;
    let vf = v.x * fx + v.z * fz;
    let vs = v.x * rx + v.z * rz;
    const prevVf = vf;
    vf = damp(vf, this.grounded ? 0 : targetF, 0.9, dt);
    vs = damp(vs, 0, 1.4, dt);
    const accelF = (vf - prevVf) / Math.max(dt, 1e-4);

    // Pedals.
    this.yawRate = damp(this.yawRate, -c.x * 1.5 * (this.grounded ? 0.3 : 1) * power, 4, dt);
    this.yaw += this.yawRate * dt;

    // Collective: hold altitude by default.
    const targetVy = power > 0 ? c.lift * 11 * power - (1 - power) * 4 : -G;
    v.y = damp(v.y, targetVy, power > 0 ? 2.2 : 0.8, dt);

    const nfx = Math.sin(this.yaw);
    const nfz = Math.cos(this.yaw);
    v.x = nfx * vf + -nfz * vs;
    v.z = nfz * vf + nfx * vs;

    pos.addScaledVector(v, dt);

    const ground = Math.max(groundAt(pos.x, pos.z), WATER_LEVEL);
    if (pos.y <= ground) {
      if (v.y < -8) this.emit('land', -v.y);
      if (!this.grounded && groundAt(pos.x, pos.z) < WATER_LEVEL && Math.hypot(v.x, v.z) > 2) this.emit('splash', 5);
      pos.y = ground;
      v.y = Math.max(0, v.y);
      v.x *= Math.exp(-6 * dt);
      v.z *= Math.exp(-6 * dt);
      this.grounded = true;
    } else {
      this.grounded = pos.y < ground + 0.05;
    }
    pos.y = Math.min(pos.y, 420);

    const hit = collide(pos.x, pos.z, pos.y, 4.6, 3.2);
    if (hit.hit) {
      pos.x += hit.nx * hit.depth;
      pos.z += hit.nz * hit.depth;
      const vn = v.x * hit.nx + v.z * hit.nz;
      if (vn < 0) {
        v.x -= vn * hit.nx * 1.5;
        v.z -= vn * hit.nz * 1.5;
        if (-vn > 3) this.emit('bump', -vn);
      }
    }

    // Body attitude: nose down to fly forward, banked into turns.
    this.vLocal.set(vf, vs);
    const pitchTarget = this.grounded ? 0 : clamp(vf * 0.0075 + accelF * 0.035, -0.32, 0.4);
    const rollTarget = this.grounded ? 0 : clamp(-this.yawRate * vf * 0.012 - vs * 0.01, -0.45, 0.45);
    this.tiltPitch = damp(this.tiltPitch, pitchTarget, 3, dt);
    this.tiltRoll = damp(this.tiltRoll, rollTarget, 3, dt);

    this.rotor += this.spool * 26 * dt;
    this.tailRotor += this.spool * 60 * dt;
    this.speed = Math.hypot(v.x, v.z);
    this.throttle = power;
    this.rpm = damp(this.rpm, this.spool * (0.7 + Math.max(0, c.lift) * 0.15 + Math.abs(c.y) * 0.1), 3, dt);
    this.airTime = this.grounded ? 0 : this.airTime + dt;
    this.orient();
  }

  private orient() {
    this.quaternion.setFromEuler(_e.set(this.tiltPitch, this.yaw, this.tiltRoll, 'YXZ'));
    this.heading.set(Math.sin(this.yaw), 0, Math.cos(this.yaw));
  }
}

/* ================================================================== boat */

const BOAT = {
  maxSpeed: 27,
  boostSpeed: 38,
  accel: 7.5,
  reverse: 5,
  turn: 1.05,
  radius: 2.2,
};

export class BoatSim extends Sim {
  readonly kind = 'boat' as const;
  yaw = 0;
  vy = 0;
  pitchV = 0;
  rollV = 0;
  /** 0..1, how far the hull has climbed onto the plane. */
  planing = 0;
  slip = 0;
  private bow = 0;
  private roll = 0;
  private yawRate = 0;

  reset(o: SpawnOptions) {
    this.position.set(o.x, WATER_LEVEL, o.z);
    this.yaw = o.yaw;
    const s = o.speed ?? 0;
    this.velocity.set(Math.sin(o.yaw) * s, 0, Math.cos(o.yaw) * s);
    this.vy = 0;
    this.bow = this.roll = 0;
    this.planing = 0;
    this.dead = 0;
    this.event = null;
    this.quaternion.setFromEuler(_e.set(0, this.yaw, 0, 'YXZ'));
    this.heading.set(Math.sin(this.yaw), 0, Math.cos(this.yaw));
  }

  step(dt: number, c: Controls, t: number) {
    const pos = this.position;
    const v = this.velocity;
    const fx = Math.sin(this.yaw);
    const fz = Math.cos(this.yaw);
    const rx = -fz;
    const rz = fx;
    let vf = v.x * fx + v.z * fz;
    let vs = v.x * rx + v.z * rz;

    const top = c.boost ? BOAT.boostSpeed : BOAT.maxSpeed;
    let a = 0;
    if (c.y > 0) a = BOAT.accel * c.y * (1 - Math.pow(clamp(vf / top, 0, 1), 2)) * (c.boost ? 1.4 : 1);
    else if (c.y < 0) a = vf > 0 ? -9 * -c.y : vf > -BOAT.reverse ? -3 * -c.y : 0;
    // Water drag: hull drag drops once it's planing.
    a -= Math.sign(vf) * (0.6 + vf * vf * (0.006 - this.planing * 0.0025));
    vf += a * dt;

    // Rudder + thrust vectoring: works at idle, bites harder at speed.
    const authority = clamp(Math.abs(vf) / 8, 0.3, 1) * Math.sign(vf || 1);
    this.yawRate = damp(this.yawRate, -c.x * BOAT.turn * authority, 3.5, dt);
    this.yaw += this.yawRate * dt;
    // Boats slide: weak lateral grip.
    vs = vs * Math.exp(-(c.brake ? 0.7 : 2.4) * dt) + (-this.yawRate * vf * 0.04) * dt;
    this.slip = Math.abs(vs);

    const nfx = Math.sin(this.yaw);
    const nfz = Math.cos(this.yaw);
    v.x = nfx * vf + -nfz * vs;
    v.z = nfz * vf + nfx * vs;

    const ox = pos.x;
    const oz = pos.z;
    pos.x += v.x * dt;
    pos.z += v.z * dt;

    // Shore: the hull grounds on anything shallower than its draught.
    const bed = groundAt(pos.x, pos.z);
    if (bed > WATER_LEVEL - 0.55) {
      pos.x = ox;
      pos.z = oz;
      const impact = Math.abs(vf);
      v.multiplyScalar(-0.2);
      if (impact > 3) this.emit('bump', impact);
    }
    const hit = collide(pos.x, pos.z, pos.y, BOAT.radius, 1.2);
    if (hit.hit) {
      pos.x += hit.nx * hit.depth;
      pos.z += hit.nz * hit.depth;
      const vn = v.x * hit.nx + v.z * hit.nz;
      if (vn < 0) {
        v.x -= vn * hit.nx * 1.3;
        v.z -= vn * hit.nz * 1.3;
        if (-vn > 3) this.emit('bump', -vn);
      }
    }

    // Buoyancy: a spring towards the local wave height.
    this.planing = damp(this.planing, clamp((Math.abs(vf) - 9) / 10, 0, 1), 1.5, dt);
    const surface = waveAt(pos.x, pos.z, t) + this.planing * 0.22;
    this.vy += ((surface - pos.y) * 38 - this.vy * 5.5) * dt;
    pos.y += this.vy * dt;

    // Hull attitude: wave slope + bow rise on the throttle + lean into turns.
    const e = 1.6;
    const slopeF = (waveAt(pos.x + nfx * e, pos.z + nfz * e, t) - waveAt(pos.x - nfx * e, pos.z - nfz * e, t)) / (2 * e);
    const slopeS = (waveAt(pos.x - nfz * e, pos.z + nfx * e, t) - waveAt(pos.x + nfz * e, pos.z - nfx * e, t)) / (2 * e);
    const bowTarget = -Math.atan(slopeF) - clamp(a * 0.025, -0.06, 0.12) - this.planing * 0.07 + (1 - this.planing) * clamp(vf / 12, 0, 1) * -0.1;
    const rollTarget = -Math.atan(slopeS) + clamp(-this.yawRate * vf * 0.018, -0.3, 0.3);
    this.pitchV += (90 * (bowTarget - this.bow) - 8 * this.pitchV) * dt;
    this.rollV += (70 * (rollTarget - this.roll) - 7 * this.rollV) * dt;
    this.bow += this.pitchV * dt;
    this.roll += this.rollV * dt;

    this.quaternion.setFromEuler(_e.set(this.bow, this.yaw, this.roll, 'YXZ'));
    this.heading.set(nfx, 0, nfz);
    this.speed = vf;
    this.throttle = Math.max(0, c.y);
    this.rpm = damp(this.rpm, 0.2 + Math.abs(c.y) * 0.6 + clamp(Math.abs(vf) / top, 0, 1) * 0.25, 4, dt);
    this.grounded = true;
    this.airTime = 0;
  }
}

export function createSims() {
  return {
    car: new GroundSim('car'),
    bike: new GroundSim('bike'),
    plane: new PlaneSim(),
    heli: new HeliSim(),
    boat: new BoatSim(),
  } satisfies Record<VehicleKind, Sim>;
}
