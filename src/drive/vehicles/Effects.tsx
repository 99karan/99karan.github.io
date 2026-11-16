import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { runtime } from '../state';

/* =============================================================== particles */

type Kind = 'splash' | 'fire' | 'smoke' | 'dust' | 'spray' | 'sparkle' | 'tyre';

const KINDS: Record<Kind, { color: string; life: [number, number]; size: [number, number]; gravity: number; drag: number; grow: number; alpha: number }> = {
  splash: { color: '#e9f6ff', life: [0.6, 1.1], size: [0.5, 1.1], gravity: 11, drag: 0.6, grow: 0.6, alpha: 0.9 },
  spray: { color: '#f2fbff', life: [0.35, 0.7], size: [0.3, 0.7], gravity: 9, drag: 1.2, grow: 1.2, alpha: 0.75 },
  fire: { color: '#ffb347', life: [0.35, 0.7], size: [1.8, 3.2], gravity: -3, drag: 2.5, grow: 1.6, alpha: 1 },
  smoke: { color: '#5d5f63', life: [1.6, 2.8], size: [2.5, 4.5], gravity: -1.6, drag: 1.4, grow: 0.9, alpha: 0.6 },
  dust: { color: '#bfae8c', life: [0.8, 1.4], size: [1.2, 2.2], gravity: -0.3, drag: 2.4, grow: 1.4, alpha: 0.45 },
  tyre: { color: '#e8e8e8', life: [1.0, 1.8], size: [0.9, 1.4], gravity: -0.6, drag: 2.2, grow: 1.6, alpha: 0.35 },
  sparkle: { color: '#9ff5dd', life: [0.6, 1.2], size: [0.14, 0.32], gravity: 3, drag: 1.4, grow: -0.4, alpha: 1 },
};

const MAX = 900;

interface Pending {
  kind: Kind;
  x: number;
  y: number;
  z: number;
  count: number;
  speed: number;
  vx: number;
  vy: number;
  vz: number;
  spread: number;
}

const queue: Pending[] = [];

export const fx = {
  burst(kind: Kind, x: number, y: number, z: number, count: number, speed = 4, vx = 0, vy = 0, vz = 0, spread = 1) {
    queue.push({ kind, x, y, z, count, speed, vx, vy, vz, spread });
  },
};

const pointVertex = /* glsl */ `
  attribute float aSize;
  attribute float aAlpha;
  attribute vec3 aColor;
  varying float vAlpha;
  varying vec3 vColor;
  uniform float uScale;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * uScale / max(0.1, -mv.z);
    gl_Position = projectionMatrix * mv;
    vAlpha = aAlpha;
    vColor = aColor;
  }
`;

const pointFragment = /* glsl */ `
  varying float vAlpha;
  varying vec3 vColor;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float d = length(c);
    float a = smoothstep(0.5, 0.15, d) * vAlpha;
    if (a < 0.01) discard;
    gl_FragColor = vec4(vColor, a);
    #include <colorspace_fragment>
  }
`;

export function Particles() {
  const sim = useMemo(() => {
    return {
      pos: new Float32Array(MAX * 3),
      vel: new Float32Array(MAX * 3),
      life: new Float32Array(MAX),
      max: new Float32Array(MAX),
      size: new Float32Array(MAX),
      alpha: new Float32Array(MAX),
      base: new Float32Array(MAX),
      color: new Float32Array(MAX * 3),
      kind: new Array<Kind>(MAX).fill('dust'),
      cursor: 0,
    };
  }, []);

  const { geometry, material } = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(sim.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aSize', new THREE.BufferAttribute(sim.size, 1).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aAlpha', new THREE.BufferAttribute(sim.alpha, 1).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aColor', new THREE.BufferAttribute(sim.color, 3).setUsage(THREE.DynamicDrawUsage));
    const m = new THREE.ShaderMaterial({
      vertexShader: pointVertex,
      fragmentShader: pointFragment,
      transparent: true,
      depthWrite: false,
      uniforms: { uScale: { value: 600 } },
    });
    return { geometry: g, material: m };
  }, [sim]);

  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material],
  );

  const tmp = useMemo(() => new THREE.Color(), []);

  useFrame(({ size }, dt) => {
    material.uniforms.uScale.value = size.height * 0.9;
    dt = Math.min(dt, 0.05);

    while (queue.length) {
      const p = queue.shift()!;
      const k = KINDS[p.kind];
      tmp.set(k.color);
      for (let n = 0; n < p.count; n++) {
        const i = sim.cursor;
        sim.cursor = (sim.cursor + 1) % MAX;
        const a = Math.random() * Math.PI * 2;
        const up = 0.3 + Math.random() * 0.7;
        const s = p.speed * (0.4 + Math.random() * 0.6);
        sim.pos[i * 3] = p.x + (Math.random() - 0.5) * p.spread;
        sim.pos[i * 3 + 1] = p.y + Math.random() * 0.3;
        sim.pos[i * 3 + 2] = p.z + (Math.random() - 0.5) * p.spread;
        sim.vel[i * 3] = p.vx + Math.cos(a) * s * (1 - up * 0.5);
        sim.vel[i * 3 + 1] = p.vy + up * s;
        sim.vel[i * 3 + 2] = p.vz + Math.sin(a) * s * (1 - up * 0.5);
        const life = k.life[0] + Math.random() * (k.life[1] - k.life[0]);
        sim.life[i] = life;
        sim.max[i] = life;
        sim.size[i] = k.size[0] + Math.random() * (k.size[1] - k.size[0]);
        sim.base[i] = k.alpha;
        sim.kind[i] = p.kind;
        const shade = 0.85 + Math.random() * 0.15;
        sim.color[i * 3] = tmp.r * shade;
        sim.color[i * 3 + 1] = tmp.g * shade;
        sim.color[i * 3 + 2] = tmp.b * shade;
      }
    }

    for (let i = 0; i < MAX; i++) {
      if (sim.life[i] <= 0) {
        sim.alpha[i] = 0;
        continue;
      }
      const k = KINDS[sim.kind[i]];
      sim.life[i] -= dt;
      const drag = Math.exp(-k.drag * dt);
      sim.vel[i * 3] *= drag;
      sim.vel[i * 3 + 1] = sim.vel[i * 3 + 1] * drag - k.gravity * dt;
      sim.vel[i * 3 + 2] *= drag;
      sim.pos[i * 3] += sim.vel[i * 3] * dt;
      sim.pos[i * 3 + 1] += sim.vel[i * 3 + 1] * dt;
      sim.pos[i * 3 + 2] += sim.vel[i * 3 + 2] * dt;
      sim.size[i] = Math.max(0.05, sim.size[i] * (1 + k.grow * dt));
      const t = sim.life[i] / sim.max[i];
      sim.alpha[i] = Math.max(0, sim.base[i] * Math.min(1, t * 2.2) * (1 - runtime.nightMix * 0.4));
      if (sim.kind[i] === 'fire') {
        // fire cools from yellow-white to deep orange
        sim.color[i * 3 + 1] = 0.45 + t * 0.4;
        sim.color[i * 3 + 2] = 0.1 + t * 0.2;
      }
    }
    (geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    (geometry.attributes.aSize as THREE.BufferAttribute).needsUpdate = true;
    (geometry.attributes.aAlpha as THREE.BufferAttribute).needsUpdate = true;
    (geometry.attributes.aColor as THREE.BufferAttribute).needsUpdate = true;
  });

  return <points geometry={geometry} material={material} frustumCulled={false} renderOrder={5} />;
}

/* ================================================================== marks */

const MARKS = 700;

interface MarkPending {
  x: number;
  y: number;
  z: number;
  yaw: number;
  w: number;
  l: number;
  wake: boolean;
}
const markQueue: MarkPending[] = [];

export const marks = {
  add(x: number, y: number, z: number, yaw: number, w: number, l: number, wake = false) {
    markQueue.push({ x, y, z, yaw, w, l, wake });
  },
};

const markVertex = /* glsl */ `
  attribute float aBirth;
  attribute float aWake;
  uniform float uTime;
  varying float vAlpha;
  varying float vWake;
  varying vec2 vUv;
  void main() {
    float age = uTime - aBirth;
    float life = mix(14.0, 3.2, aWake);
    vAlpha = clamp(1.0 - age / life, 0.0, 1.0);
    vWake = aWake;
    vUv = uv;
    vec3 p = position;
    p.x *= 1.0 + aWake * age * 1.1;
    gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(p, 1.0);
  }
`;

const markFragment = /* glsl */ `
  varying float vAlpha;
  varying float vWake;
  varying vec2 vUv;
  void main() {
    float edge = smoothstep(0.0, 0.25, vUv.x) * smoothstep(1.0, 0.75, vUv.x);
    vec3 col = mix(vec3(0.05), vec3(0.96, 0.98, 1.0), vWake);
    float a = vAlpha * edge * mix(0.55, 0.7, vWake);
    if (a < 0.01) discard;
    gl_FragColor = vec4(col, a);
    #include <colorspace_fragment>
  }
`;

export function Marks() {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const cursor = useRef(0);
  const { geometry, material } = useMemo(() => {
    const g = new THREE.PlaneGeometry(1, 1);
    g.rotateX(-Math.PI / 2);
    const birth = new Float32Array(MARKS).fill(-1000);
    g.setAttribute('aBirth', new THREE.InstancedBufferAttribute(birth, 1).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aWake', new THREE.InstancedBufferAttribute(new Float32Array(MARKS), 1).setUsage(THREE.DynamicDrawUsage));
    const m = new THREE.ShaderMaterial({
      vertexShader: markVertex,
      fragmentShader: markFragment,
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -6,
      uniforms: { uTime: { value: 0 } },
    });
    return { geometry: g, material: m };
  }, []);

  const o = useMemo(() => new THREE.Object3D(), []);

  useFrame(() => {
    material.uniforms.uTime.value = runtime.elapsed;
    const m = mesh.current;
    if (!m || !markQueue.length) return;
    const birth = geometry.attributes.aBirth as THREE.InstancedBufferAttribute;
    const wake = geometry.attributes.aWake as THREE.InstancedBufferAttribute;
    while (markQueue.length) {
      const k = markQueue.shift()!;
      const i = cursor.current;
      cursor.current = (cursor.current + 1) % MARKS;
      o.position.set(k.x, k.y, k.z);
      o.rotation.set(0, k.yaw, 0);
      o.scale.set(k.w, 1, k.l);
      o.updateMatrix();
      m.setMatrixAt(i, o.matrix);
      birth.setX(i, runtime.elapsed);
      wake.setX(i, k.wake ? 1 : 0);
    }
    m.instanceMatrix.needsUpdate = true;
    birth.needsUpdate = true;
    wake.needsUpdate = true;
  });

  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material],
  );

  return <instancedMesh ref={mesh} args={[geometry, material, MARKS]} frustumCulled={false} renderOrder={3} />;
}
