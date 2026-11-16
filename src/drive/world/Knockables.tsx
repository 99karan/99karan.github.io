import { useEffect, useMemo, useRef, type ReactNode } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  CuboidCollider,
  CylinderCollider,
  Physics,
  RigidBody,
  TrimeshCollider,
  useBeforePhysicsStep,
  type RapierRigidBody,
} from '@react-three/rapier';
import * as THREE from 'three';
import { FontLoader } from 'three/examples/jsm/loaders/FontLoader.js';
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry.js';
import fontJson from 'three/examples/fonts/helvetiker_bold.typeface.json';
import { profile } from '../../data/portfolio';
import { runtime, store, type VehicleKind } from '../state';
import { groundAt, ZONES } from './map';

/**
 * Things you can knock over. Rapier simulates them; the active vehicle is a
 * kinematic body that shoves them around (one-way, like a bowling ball that
 * happens to be a car).
 */

/* ---------------------------------------------------------- ground mesh */

const REGION = { x0: -70, x1: 70, z0: -104, z1: 50, step: 2 };

function useGroundMesh() {
  return useMemo(() => {
    const nx = Math.round((REGION.x1 - REGION.x0) / REGION.step) + 1;
    const nz = Math.round((REGION.z1 - REGION.z0) / REGION.step) + 1;
    const vertices = new Float32Array(nx * nz * 3);
    for (let j = 0; j < nz; j++) {
      for (let i = 0; i < nx; i++) {
        const x = REGION.x0 + i * REGION.step;
        const z = REGION.z0 + j * REGION.step;
        const k = (j * nx + i) * 3;
        vertices[k] = x;
        vertices[k + 1] = groundAt(x, z);
        vertices[k + 2] = z;
      }
    }
    const indices = new Uint32Array((nx - 1) * (nz - 1) * 6);
    let t = 0;
    for (let j = 0; j < nz - 1; j++) {
      for (let i = 0; i < nx - 1; i++) {
        const a = j * nx + i;
        const b = a + 1;
        const c = a + nx;
        const d = c + 1;
        indices.set([a, c, b, b, c, d], t);
        t += 6;
      }
    }
    return { vertices, indices };
  }, []);
}

function Ground() {
  const { vertices, indices } = useGroundMesh();
  return (
    <RigidBody type="fixed" colliders={false}>
      <TrimeshCollider args={[vertices, indices]} friction={0.9} />
    </RigidBody>
  );
}

/* ------------------------------------------------------- vehicle body */

const VEHICLE_BOX: Record<VehicleKind, { half: [number, number, number]; y: number }> = {
  car: { half: [0.95, 0.55, 2.3], y: 0.75 },
  bike: { half: [0.35, 0.75, 1.05], y: 0.85 },
  plane: { half: [5.2, 0.6, 4.0], y: 1.4 },
  heli: { half: [1.1, 1.2, 2.2], y: 1.4 },
  boat: { half: [1.2, 0.7, 3.3], y: 0.5 },
};

function VehicleBody({ vehicle }: { vehicle: VehicleKind }) {
  const body = useRef<RapierRigidBody>(null);
  const offset = useMemo(() => new THREE.Vector3(), []);
  useBeforePhysicsStep(() => {
    const b = body.current;
    if (!b) return;
    offset.set(0, VEHICLE_BOX[vehicle].y, 0).applyQuaternion(runtime.quaternion).add(runtime.position);
    b.setNextKinematicTranslation(offset);
    b.setNextKinematicRotation(runtime.quaternion);
  });
  const box = VEHICLE_BOX[vehicle];
  return (
    <RigidBody key={vehicle} ref={body} type="kinematicPosition" colliders={false} position={[runtime.position.x, runtime.position.y + box.y, runtime.position.z]}>
      <CuboidCollider args={box.half} />
    </RigidBody>
  );
}

/* --------------------------------------------------------- dynamic prop */

interface PropProps {
  position: [number, number, number];
  rotation?: [number, number, number];
  children: ReactNode;
  colliders?: 'cuboid' | 'hull' | false;
  mass?: number;
  onBody?: (body: RapierRigidBody) => void;
}

/** A dynamic body that returns home if it falls into the sea or off the map. */
function Prop({ position, rotation = [0, 0, 0], children, colliders = 'cuboid', mass, onBody }: PropProps) {
  const body = useRef<RapierRigidBody>(null);
  const home = useMemo(() => ({ p: new THREE.Vector3(...position), q: new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotation)) }), [position, rotation]);
  useEffect(() => {
    if (body.current && onBody) onBody(body.current);
  }, [onBody]);
  useFrame(() => {
    const b = body.current;
    if (!b || b.isSleeping()) return;
    const t = b.translation();
    if (t.y < -6 || Math.abs(t.x) > REGION.x1 + 30 || t.z < REGION.z0 - 30 || t.z > REGION.z1 + 30) {
      b.setTranslation(home.p, true);
      b.setRotation(home.q, true);
      b.setLinvel({ x: 0, y: 0, z: 0 }, true);
      b.setAngvel({ x: 0, y: 0, z: 0 }, true);
    }
  });
  return (
    <RigidBody
      ref={body}
      position={position}
      rotation={rotation}
      colliders={colliders}
      mass={mass}
      friction={0.8}
      restitution={0.15}
      linearDamping={0.15}
      angularDamping={0.3}
      canSleep
    >
      {children}
    </RigidBody>
  );
}

/* --------------------------------------------------------------- letters */

const font = new FontLoader().parse(fontJson as unknown as Parameters<FontLoader['parse']>[0]);

function letterGeometry(char: string, size: number) {
  const g = new TextGeometry(char, {
    font,
    size,
    depth: size * 0.38,
    curveSegments: 6,
    bevelEnabled: true,
    bevelThickness: size * 0.04,
    bevelSize: size * 0.03,
    bevelSegments: 3,
  });
  g.computeBoundingBox();
  const b = g.boundingBox!;
  // Centre on x/z, sit the glyph's base on y = 0 relative to its centre.
  g.translate(-(b.min.x + b.max.x) / 2, -(b.min.y + b.max.y) / 2, -(b.min.z + b.max.z) / 2);
  g.computeBoundingBox();
  return g;
}

function NameLetters() {
  const words = profile.name.split(' ');
  const size = 3.4;
  const letters = useMemo(() => {
    const out: { char: string; geo: THREE.BufferGeometry; x: number; z: number; accent: boolean }[] = [];
    words.forEach((word, row) => {
      const geos = [...word].map((c) => letterGeometry(c, row === 0 ? size : size * 0.72));
      const widths = geos.map((g) => g.boundingBox!.max.x - g.boundingBox!.min.x);
      const gap = row === 0 ? 0.55 : 0.4;
      const total = widths.reduce((a, b) => a + b, 0) + gap * (geos.length - 1);
      let cursor = -total / 2;
      geos.forEach((geo, i) => {
        out.push({ char: word[i], geo, x: cursor + widths[i] / 2, z: -22 - row * 7, accent: row === 0 });
        cursor += widths[i] + gap;
      });
    });
    return out;
  }, [words]);

  const mats = useMemo(
    () => ({
      accent: new THREE.MeshPhysicalMaterial({ color: '#0f7f71', roughness: 0.3, metalness: 0.3, clearcoat: 1, clearcoatRoughness: 0.1 }),
      white: new THREE.MeshPhysicalMaterial({ color: '#f2f2ee', roughness: 0.35, metalness: 0.05, clearcoat: 0.6 }),
    }),
    [],
  );

  return (
    <>
      {letters.map((l, i) => {
        const h = l.geo.boundingBox!.max.y - l.geo.boundingBox!.min.y;
        return (
          <Prop key={`${l.char}-${i}`} position={[l.x, groundAt(l.x, l.z) + h / 2 + 0.02, l.z]} mass={l.accent ? 3 : 2}>
            <mesh geometry={l.geo} material={l.accent ? mats.accent : mats.white} castShadow receiveShadow />
          </Prop>
        );
      })}
    </>
  );
}

/* ---------------------------------------------------------------- crates */

function crateTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#b8874f';
  ctx.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 6; i++) {
    ctx.fillStyle = i % 2 ? 'rgba(90,55,25,0.25)' : 'rgba(255,230,190,0.12)';
    ctx.fillRect(0, i * 21, 128, 21);
  }
  ctx.strokeStyle = '#6b4724';
  ctx.lineWidth = 12;
  ctx.strokeRect(6, 6, 116, 116);
  ctx.beginPath();
  ctx.moveTo(10, 10);
  ctx.lineTo(118, 118);
  ctx.stroke();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function Crates() {
  const material = useMemo(() => new THREE.MeshStandardMaterial({ map: crateTexture(), roughness: 0.8 }), []);
  const s = 1.3;
  const base = { x: 26, z: -20 };
  const spots = useMemo(() => {
    const out: [number, number, number][] = [];
    const rows = 4;
    for (let r = 0; r < rows; r++) {
      for (let i = 0; i < rows - r; i++) {
        const x = base.x + (i - (rows - r - 1) / 2) * (s + 0.02);
        out.push([x, groundAt(base.x, base.z) + s / 2 + r * s + 0.01, base.z]);
      }
    }
    return out;
  }, [base.x, base.z]);
  return (
    <>
      {spots.map((p, i) => (
        <Prop key={i} position={p} mass={0.6}>
          <mesh material={material} castShadow receiveShadow>
            <boxGeometry args={[s, s, s]} />
          </mesh>
        </Prop>
      ))}
    </>
  );
}

/* ----------------------------------------------------------------- cones */

function Cones() {
  const mats = useMemo(
    () => ({
      orange: new THREE.MeshStandardMaterial({ color: '#ff6a1a', roughness: 0.55 }),
      white: new THREE.MeshStandardMaterial({ color: '#f4f4f0', roughness: 0.5 }),
    }),
    [],
  );
  const spots = useMemo(() => Array.from({ length: 8 }, (_, i) => [-34 + i * 5, 6 + (i % 2) * 3] as [number, number]), []);
  return (
    <>
      {spots.map(([x, z], i) => (
        <Prop key={i} position={[x, groundAt(x, z) + 0.42, z]} colliders={false} mass={0.15}>
          <CylinderCollider args={[0.42, 0.28]} />
          <mesh material={mats.orange} castShadow>
            <coneGeometry args={[0.32, 0.84, 16]} />
          </mesh>
          <mesh position={[0, 0.02, 0]} material={mats.white}>
            <cylinderGeometry args={[0.17, 0.22, 0.14, 16]} />
          </mesh>
          <mesh position={[0, -0.4, 0]} material={mats.orange}>
            <boxGeometry args={[0.7, 0.05, 0.7]} />
          </mesh>
        </Prop>
      ))}
    </>
  );
}

/* --------------------------------------------------------------- bowling */

const PIN_H = 1.9;

function usePinGeometry() {
  return useMemo(() => {
    const prof: [number, number][] = [
      [0.0, 0],
      [0.22, 0.02],
      [0.36, 0.28],
      [0.4, 0.55],
      [0.32, 0.9],
      [0.17, 1.2],
      [0.15, 1.38],
      [0.22, 1.6],
      [0.2, 1.8],
      [0.0, PIN_H],
    ];
    const g = new THREE.LatheGeometry(
      prof.map(([r, y]) => new THREE.Vector2(r, y - PIN_H / 2)),
      20,
    );
    return g;
  }, []);
}

function Bowling() {
  const geo = usePinGeometry();
  const mats = useMemo(
    () => ({
      pin: new THREE.MeshPhysicalMaterial({ color: '#f7f6f2', roughness: 0.25, clearcoat: 1 }),
      stripe: new THREE.MeshStandardMaterial({ color: '#c8102e', roughness: 0.4 }),
      lane: new THREE.MeshStandardMaterial({ color: '#c99a62', roughness: 0.45, metalness: 0.05 }),
      gutter: new THREE.MeshStandardMaterial({ color: '#2b2f36', roughness: 0.6 }),
    }),
    [],
  );
  const { x: bx, z: bz } = ZONES.bowling;
  const y0 = groundAt(bx, bz);
  const pins = useMemo(() => {
    const out: [number, number][] = [];
    const sp = 1.25;
    for (let row = 0; row < 4; row++) {
      for (let i = 0; i <= row; i++) out.push([bx + (i - row / 2) * sp, bz - row * sp * 0.9]);
    }
    return out;
  }, [bx, bz]);

  const bodies = useRef<(RapierRigidBody | null)[]>([]);
  const state = useRef({ hitAt: 0, scored: false });

  useFrame(({ clock }) => {
    const now = clock.elapsedTime;
    const s = state.current;
    let down = 0;
    for (const b of bodies.current) {
      if (!b) continue;
      const q = b.rotation();
      // How far the pin's up-axis is from vertical.
      const upY = 1 - 2 * (q.x * q.x + q.z * q.z);
      if (upY < 0.7) down++;
    }
    if (down > 0 && s.hitAt === 0) s.hitAt = now;
    if (s.hitAt && !s.scored && now - s.hitAt > 3) {
      s.scored = true;
      store.toast(
        down === pins.length
          ? { title: 'STRIKE!', body: 'All ten pins. Respect.', tone: 'skill' }
          : { title: `${down} pin${down === 1 ? '' : 's'} down`, body: 'Pins reset in a few seconds.', tone: 'info' },
      );
    }
    if (s.hitAt && now - s.hitAt > 9) {
      bodies.current.forEach((b, i) => {
        if (!b) return;
        const [x, z] = pins[i];
        b.setTranslation({ x, y: y0 + PIN_H / 2 + 0.03, z }, true);
        b.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true);
        b.setLinvel({ x: 0, y: 0, z: 0 }, true);
        b.setAngvel({ x: 0, y: 0, z: 0 }, true);
      });
      s.hitAt = 0;
      s.scored = false;
    }
  });

  return (
    <>
      {/* lane */}
      <mesh position={[bx, y0 + 0.06, bz + 8]} rotation-x={-Math.PI / 2} material={mats.lane} receiveShadow>
        <planeGeometry args={[7, 28]} />
      </mesh>
      {[-4.2, 4.2].map((dx) => (
        <mesh key={dx} position={[bx + dx, y0 + 0.05, bz + 8]} rotation-x={-Math.PI / 2} material={mats.gutter}>
          <planeGeometry args={[1.4, 28]} />
        </mesh>
      ))}
      {pins.map(([x, z], i) => (
        <Prop
          key={i}
          position={[x, y0 + PIN_H / 2 + 0.03, z]}
          colliders="hull"
          mass={0.25}
          onBody={(b) => (bodies.current[i] = b)}
        >
          <mesh geometry={geo} material={mats.pin} castShadow />
          <mesh position={[0, 0.33, 0]} material={mats.stripe}>
            <cylinderGeometry args={[0.165, 0.17, 0.08, 20]} />
          </mesh>
        </Prop>
      ))}
    </>
  );
}

/* ------------------------------------------------------------------ world */

export function PhysicsProps({ vehicle, debug = false }: { vehicle: VehicleKind; debug?: boolean }) {
  return (
    <Physics gravity={[0, -9.81, 0]} timeStep={1 / 60} debug={debug}>
      <Ground />
      <VehicleBody vehicle={vehicle} />
      <NameLetters />
      <Crates />
      <Cones />
      <Bowling />
    </Physics>
  );
}
