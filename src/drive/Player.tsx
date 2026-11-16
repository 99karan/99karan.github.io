import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { sound } from './audio';
import { onAction, updateControls } from './input';
import { runtime, store, useStore, type VehicleKind } from './state';
import { BikeModel } from './vehicles/Bike';
import { BoatModel } from './vehicles/Boat';
import { CarModel } from './vehicles/Car';
import { fx, marks } from './vehicles/Effects';
import { HeliModel } from './vehicles/Heli';
import { PlaneModel } from './vehicles/Plane';
import { createSims, type GroundSim, type Sim, type SpawnOptions } from './vehicles/sims';
import { collide } from './world/colliders';
import { groundAt, WATER_LEVEL, waveAt } from './world/map';
import { SPAWNS, zones } from './world/placements';

const DROWN_MESSAGES: Partial<Record<VehicleKind, string>> = {
  car: "Cars don't float. Press 5 for the boat.",
  bike: 'Bikes sink fast. Press 5 for the boat.',
  plane: 'Ditched in the sea. Back to the runway.',
};

function spawnFor(kind: VehicleKind, mode: 'here' | 'home'): SpawnOptions {
  const home = SPAWNS[kind];
  const p = runtime.position;
  const yaw = Math.atan2(runtime.heading.x, runtime.heading.z);
  if (mode === 'home') return { ...home };

  const ground = groundAt(p.x, p.z);
  const surface = Math.max(ground, WATER_LEVEL);
  const onLand = ground > WATER_LEVEL + 0.4;
  const blocked = collide(p.x, p.z, ground, 2.2, 2).hit;

  switch (kind) {
    case 'car':
    case 'bike':
      return onLand && !blocked ? { x: p.x, z: p.z, yaw } : { ...home };
    case 'plane':
      return p.y - surface > 25 ? { x: p.x, z: p.z, yaw, y: p.y, speed: 48, airborne: true } : { ...home };
    case 'heli':
      return blocked && p.y - surface < 6 ? { ...home } : { x: p.x, z: p.z, yaw, y: Math.max(p.y, surface) };
    case 'boat':
      return ground < WATER_LEVEL - 1.6 ? { x: p.x, z: p.z, yaw } : { ...home };
  }
}

const _v = new THREE.Vector3();

export function Player() {
  const vehicle = useStore((s) => s.vehicle);
  const spawnId = useStore((s) => s.spawnId);
  const paintIndex = useStore((s) => s.paint);
  const sims = useMemo(() => createSims(), []);
  const group = useRef<THREE.Group>(null);
  const first = useRef(true);
  const pendingRespawn = useRef<number | null>(null);
  const lastAir = useRef(0);
  const zoneId = useRef<string | null>(null);
  const downwash = useRef(0);

  const sim: Sim = sims[vehicle];

  // Place the vehicle whenever it changes or respawns.
  useLayoutEffect(() => {
    const mode = first.current ? 'home' : store.get().spawnMode;
    first.current = false;
    const o = runtime.teleport ? { ...runtime.teleport } : spawnFor(vehicle, mode);
    runtime.teleport = null;
    sim.reset(o);
    runtime.position.copy(sim.position);
    runtime.quaternion.copy(sim.quaternion);
    runtime.heading.copy(sim.heading);
    runtime.snapCamera = true;
    pendingRespawn.current = null;
    lastAir.current = 0;
    sound.setVehicle(vehicle);
    if (spawnId > 0) {
      sound.play('switch');
      fx.burst('sparkle', sim.position.x, sim.position.y + 1, sim.position.z, 24, 5);
    }
  }, [vehicle, spawnId, sim]);

  // Horn.
  useEffect(
    () =>
      onAction((a) => {
        if (a === 'horn') sound.play('horn');
      }),
    [],
  );

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 1 / 20);
    runtime.elapsed += dt;
    updateControls();
    sim.step(dt, runtime.controls, runtime.elapsed);
    const p = sim.position;

    /* ---- events ---- */
    const ev = sim.event;
    sim.event = null;
    if (ev) {
      switch (ev) {
        case 'crash':
          fx.burst('fire', p.x, p.y + 1, p.z, 40, 7);
          fx.burst('smoke', p.x, p.y + 1.5, p.z, 30, 4);
          sound.play('crash');
          runtime.shake = 1.2;
          store.toast({ title: 'Crashed!', body: 'Respawning…', tone: 'warn' }, 2000);
          pendingRespawn.current = runtime.elapsed + 1.6;
          break;
        case 'drown':
          fx.burst('splash', p.x, WATER_LEVEL, p.z, 60, 9);
          sound.play('splash');
          store.toast({ title: 'Splash!', body: DROWN_MESSAGES[vehicle] ?? 'Respawning…', tone: 'warn' }, 3200);
          pendingRespawn.current = runtime.elapsed + 1.5;
          break;
        case 'bump':
          runtime.shake = Math.min(1, sim.eventStrength / 18);
          sound.play('bump');
          fx.burst('dust', p.x, p.y + 0.5, p.z, 8, 3);
          break;
        case 'land':
          runtime.shake = Math.min(0.8, sim.eventStrength / 20);
          sound.play('land');
          fx.burst('dust', p.x, p.y + 0.2, p.z, 18, 4);
          break;
        case 'splash':
          fx.burst('splash', p.x, WATER_LEVEL, p.z, 40, Math.min(10, sim.eventStrength * 0.4));
          sound.play('splash');
          break;
      }
    }
    if (pendingRespawn.current !== null && runtime.elapsed > pendingRespawn.current) {
      pendingRespawn.current = null;
      store.respawn('home');
    }
    // Wandered off the edge of the world.
    if (Math.hypot(p.x, p.z) > 760 && pendingRespawn.current === null) {
      store.toast({ title: 'Edge of the world', body: 'Bringing you back.', tone: 'info' });
      pendingRespawn.current = runtime.elapsed + 0.5;
    }

    /* ---- publish ---- */
    runtime.position.copy(p);
    runtime.quaternion.copy(sim.quaternion);
    runtime.velocity.copy(sim.velocity);
    runtime.heading.copy(sim.heading);
    runtime.speed = sim.speed;
    runtime.rpm = sim.rpm;
    runtime.throttle = sim.throttle;
    runtime.grounded = sim.grounded;
    runtime.airTime = sim.airTime;
    runtime.altitude = p.y - Math.max(groundAt(p.x, p.z), WATER_LEVEL);

    if (group.current) {
      group.current.position.copy(p);
      group.current.quaternion.copy(sim.quaternion);
    }

    /* ---- stunts ---- */
    if (vehicle === 'car' || vehicle === 'bike') {
      if (sim.airTime > 0) lastAir.current = sim.airTime;
      else if (lastAir.current > 0) {
        if (lastAir.current > 0.9) {
          store.toast({ title: `Air time ${lastAir.current.toFixed(1)}s`, body: lastAir.current > 2 ? 'Absolutely sending it.' : 'Nice jump.', tone: 'info' }, 2200);
        }
        lastAir.current = 0;
      }
    }

    /* ---- surface effects ---- */
    const speed = Math.abs(sim.speed);
    if ((vehicle === 'car' || vehicle === 'bike') && sim.grounded) {
      const g = sim as GroundSim;
      const skidding = g.slip > 3.5 || (g.braking && speed > 12);
      if (skidding && g.waterDepth <= 0) {
        const wheels: [number, number][] = vehicle === 'car' ? [[0.8, -1.31], [-0.8, -1.31]] : [[0, -0.73]];
        for (const [lx, lz] of wheels) {
          _v.set(lx, 0, lz).applyQuaternion(sim.quaternion).add(p);
          marks.add(_v.x, groundAt(_v.x, _v.z) + 0.04, _v.z, g.yaw, vehicle === 'car' ? 0.28 : 0.2, Math.max(0.3, speed * dt * 1.3));
        }
        if (g.slip > 6 && Math.random() < 0.5) fx.burst('tyre', _v.x, _v.y + 0.2, _v.z, 1, 1.2);
      }
      if (g.waterDepth > 0.1 && speed > 3 && Math.random() < 0.6) fx.burst('splash', p.x, WATER_LEVEL, p.z, 3, speed * 0.25);
    }
    if (vehicle === 'boat' && speed > 2) {
      const yaw = Math.atan2(sim.heading.x, sim.heading.z);
      for (const s of [-1, 1]) {
        _v.set(s * 0.9, 0, -3.0).applyQuaternion(sim.quaternion).add(p);
        marks.add(_v.x, waveAt(_v.x, _v.z, runtime.elapsed) + 0.06, _v.z, yaw, 0.9, Math.max(0.4, speed * dt * 1.4), true);
      }
      if (speed > 9 && Math.random() < 0.5) {
        _v.set((Math.random() - 0.5) * 2, 0.2, 1.2).applyQuaternion(sim.quaternion).add(p);
        fx.burst('spray', _v.x, _v.y, _v.z, 2, 3 + speed * 0.12, sim.velocity.x * 0.4, 1, sim.velocity.z * 0.4);
      }
    }
    if (vehicle === 'heli' && runtime.altitude < 12) {
      const heli = sims.heli;
      downwash.current -= dt;
      if (heli.spool > 0.75 && downwash.current <= 0) {
        downwash.current = 0.06;
        const ground = groundAt(p.x, p.z);
        const overWater = ground < WATER_LEVEL;
        const a = Math.random() * Math.PI * 2;
        const r = 2 + Math.random() * 3;
        const k = 1 - runtime.altitude / 12;
        fx.burst(overWater ? 'spray' : 'dust', p.x + Math.cos(a) * r, Math.max(ground, WATER_LEVEL), p.z + Math.sin(a) * r, 2, 6 * k, Math.cos(a) * 8 * k, 0, Math.sin(a) * 8 * k);
      }
    }

    /* ---- zones ---- */
    let inside: string | null = null;
    if (runtime.altitude < 14) {
      for (const z of zones) {
        if (Math.hypot(p.x - z.x, p.z - z.z) < z.r) {
          inside = z.id;
          break;
        }
      }
    }
    if (inside !== zoneId.current) {
      zoneId.current = inside;
      store.set({ zone: inside });
    }

    /* ---- sound ---- */
    const slip = vehicle === 'car' || vehicle === 'bike' ? (sim as GroundSim).slip : 0;
    sound.update(sim.rpm, vehicle === 'heli' ? sims.heli.spool * 20 + speed : speed, sim.grounded ? slip : 0);
  });

  return (
    <group ref={group}>
      {vehicle === 'car' && <CarModel sim={sims.car} paintIndex={paintIndex} />}
      {vehicle === 'bike' && <BikeModel sim={sims.bike} />}
      {vehicle === 'plane' && <PlaneModel sim={sims.plane} />}
      {vehicle === 'heli' && <HeliModel sim={sims.heli} />}
      {vehicle === 'boat' && <BoatModel sim={sims.boat} />}
    </group>
  );
}
