import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { fbm, terrainAt, WORLD_SIZE } from './map';
import { runtime } from '../state';

/* ================================================================ terrain */

function noiseTexture(size = 256) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d')!;
  const img = ctx.createImageData(size, size);
  for (let i = 0; i < size * size; i++) {
    const x = i % size;
    const y = Math.floor(i / size);
    const n = fbm(x * 0.09, y * 0.09, 3) * 0.6 + Math.random() * 0.4;
    const v = 200 + n * 55;
    img.data[i * 4] = v;
    img.data[i * 4 + 1] = v;
    img.data[i * 4 + 2] = v;
    img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

const C = {
  deep: new THREE.Color('#8f8166'),
  wetSand: new THREE.Color('#c9b48a'),
  sand: new THREE.Color('#e6d3a3'),
  grass: new THREE.Color('#5f9238'),
  grassDark: new THREE.Color('#3f7428'),
  grassDry: new THREE.Color('#9fae58'),
  rock: new THREE.Color('#7f7a72'),
  rockDark: new THREE.Color('#5d5952'),
};

export function Terrain({ segments }: { segments: number }) {
  const { geometry, material } = useMemo(() => {
    const g = new THREE.PlaneGeometry(WORLD_SIZE, WORLD_SIZE, segments, segments);
    g.rotateX(-Math.PI / 2);
    const pos = g.attributes.position as THREE.BufferAttribute;
    const colors = new Float32Array(pos.count * 3);
    const col = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      pos.setY(i, terrainAt(x, z));
    }
    g.computeVertexNormals();
    const nrm = g.attributes.normal as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const h = pos.getY(i);
      const slope = 1 - nrm.getY(i);
      const n = fbm(x * 0.05, z * 0.05, 3);
      const n2 = fbm(x * 0.013 + 7, z * 0.013 - 3, 3);

      if (h < -0.4) {
        col.copy(C.deep).lerp(C.wetSand, THREE.MathUtils.smoothstep(h, -6, -0.4));
      } else if (h < 1.35 + n * 0.6) {
        col.copy(C.wetSand).lerp(C.sand, THREE.MathUtils.smoothstep(h, -0.4, 0.5));
      } else {
        col.copy(C.grassDark).lerp(C.grass, n);
        col.lerp(C.grassDry, THREE.MathUtils.smoothstep(n2, 0.55, 0.75) * 0.7);
        // sand → grass transition
        col.lerp(C.sand, 1 - THREE.MathUtils.smoothstep(h, 1.35, 2.1));
      }
      const rocky = THREE.MathUtils.smoothstep(slope, 0.16, 0.3) + THREE.MathUtils.smoothstep(h, 34, 46) * 0.7;
      if (rocky > 0) col.lerp(n > 0.5 ? C.rock : C.rockDark, Math.min(1, rocky));
      colors[i * 3] = col.r;
      colors[i * 3 + 1] = col.g;
      colors[i * 3 + 2] = col.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const map = noiseTexture();
    map.repeat.set(WORLD_SIZE / 6, WORLD_SIZE / 6);
    const m = new THREE.MeshStandardMaterial({ vertexColors: true, map, roughness: 0.94, metalness: 0 });
    return { geometry: g, material: m };
  }, [segments]);

  useEffect(
    () => () => {
      geometry.dispose();
      material.map?.dispose();
      material.dispose();
    },
    [geometry, material],
  );

  return <mesh geometry={geometry} material={material} receiveShadow />;
}

/* ================================================================== water */

const SEABED_RES = 256;

function seabedTexture() {
  const data = new Uint8Array(SEABED_RES * SEABED_RES * 4);
  for (let j = 0; j < SEABED_RES; j++) {
    for (let i = 0; i < SEABED_RES; i++) {
      const x = (i / (SEABED_RES - 1) - 0.5) * WORLD_SIZE;
      const z = (j / (SEABED_RES - 1) - 0.5) * WORLD_SIZE;
      const h = terrainAt(x, z);
      const v = Math.max(0, Math.min(255, ((h + 12) / 16) * 255));
      const k = (j * SEABED_RES + i) * 4;
      data[k] = v;
      data[k + 1] = v;
      data[k + 2] = v;
      data[k + 3] = 255;
    }
  }
  const t = new THREE.DataTexture(data, SEABED_RES, SEABED_RES, THREE.RGBAFormat);
  t.magFilter = THREE.LinearFilter;
  t.minFilter = THREE.LinearFilter;
  t.needsUpdate = true;
  return t;
}

const waterVertex = /* glsl */ `
  uniform float uTime;
  varying vec3 vWorld;
  varying vec3 vNormalW;
  #include <fog_pars_vertex>

  // Keep in sync with waveAt() in map.ts.
  float wave(vec2 p, float t) {
    return sin(p.x * 0.07 + t * 0.9) * 0.22
         + sin(p.y * 0.09 - t * 1.1 + p.x * 0.03) * 0.18
         + sin((p.x + p.y) * 0.16 + t * 1.7) * 0.07;
  }

  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    float h = wave(world.xz, uTime);
    float e = 0.6;
    float hx = wave(world.xz + vec2(e, 0.0), uTime) - wave(world.xz - vec2(e, 0.0), uTime);
    float hz = wave(world.xz + vec2(0.0, e), uTime) - wave(world.xz - vec2(0.0, e), uTime);
    vNormalW = normalize(vec3(-hx, 2.0 * e, -hz));
    world.y += h;
    vWorld = world.xyz;
    vec4 mvPosition = viewMatrix * world;
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }
`;

const waterFragment = /* glsl */ `
  uniform float uTime;
  uniform sampler2D uSeabed;
  uniform float uWorld;
  uniform vec3 uSunDir;
  uniform vec3 uSunColor;
  uniform vec3 uSky;
  uniform vec3 uHorizon;
  uniform vec3 uShallow;
  uniform vec3 uDeep;
  uniform float uNight;
  varying vec3 vWorld;
  varying vec3 vNormalW;
  #include <fog_pars_fragment>

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p); vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
  }

  void main() {
    vec2 uv = vWorld.xz / uWorld + 0.5;
    float inside = step(0.0, uv.x) * step(uv.x, 1.0) * step(0.0, uv.y) * step(uv.y, 1.0);
    float bed = mix(-12.0, texture2D(uSeabed, uv).r * 16.0 - 12.0, inside);
    float depth = max(0.0, vWorld.y - bed);

    // Ripples: two scrolling noise layers perturb the normal.
    vec2 p = vWorld.xz;
    float n1 = noise(p * 0.35 + vec2(uTime * 0.35, uTime * 0.2));
    float n2 = noise(p * 0.8 - vec2(uTime * 0.25, -uTime * 0.4));
    vec3 n = normalize(vNormalW + vec3(n1 - 0.5, 0.0, n2 - 0.5) * 0.35);

    vec3 viewDir = normalize(cameraPosition - vWorld);
    float fres = pow(1.0 - max(dot(n, viewDir), 0.0), 4.0);

    vec3 water = mix(uShallow, uDeep, 1.0 - exp(-depth * 0.28));
    vec3 reflected = mix(uHorizon, uSky, clamp(reflect(-viewDir, n).y * 2.0, 0.0, 1.0));
    vec3 col = mix(water, reflected, 0.18 + fres * 0.7);

    // Sun glitter.
    vec3 h = normalize(uSunDir + viewDir);
    float spec = pow(max(dot(n, h), 0.0), 220.0) * 3.0 + pow(max(dot(n, h), 0.0), 24.0) * 0.12;
    col += uSunColor * spec * (1.0 - uNight * 0.6);

    // Shore foam: a breathing band where the water gets thin.
    float band = 1.0 - smoothstep(0.0, 0.9 + n1 * 0.6, depth);
    float wash = smoothstep(0.35, 0.75, noise(p * 0.6 + uTime * 0.5)) * (1.0 - smoothstep(0.0, 2.2, depth)) * (0.5 + 0.5 * sin(uTime * 1.3 + depth * 4.0));
    float foam = clamp(band * 0.9 + wash * 0.45, 0.0, 1.0);
    col = mix(col, vec3(0.95, 0.97, 1.0) * (1.0 - uNight * 0.7), foam);

    float alpha = mix(0.55, 0.96, 1.0 - exp(-depth * 0.45));
    alpha = max(alpha, foam);
    gl_FragColor = vec4(col, alpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    #include <fog_fragment>
  }
`;

export const atmosphere = {
  sunDir: new THREE.Vector3(0.45, 0.62, 0.35).normalize(),
  sunColor: new THREE.Color('#fff1d6'),
  sky: new THREE.Color('#5d9bd8'),
  horizon: new THREE.Color('#cfe4f2'),
};

export function Water({ segments }: { segments: number }) {
  const mesh = useRef<THREE.Mesh>(null);
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: waterVertex,
        fragmentShader: waterFragment,
        transparent: true,
        fog: true,
        uniforms: THREE.UniformsUtils.merge([
          THREE.UniformsLib.fog,
          {
            uTime: { value: 0 },
            uSeabed: { value: null },
            uWorld: { value: WORLD_SIZE },
            uSunDir: { value: new THREE.Vector3() },
            uSunColor: { value: new THREE.Color() },
            uSky: { value: new THREE.Color() },
            uHorizon: { value: new THREE.Color() },
            uShallow: { value: new THREE.Color('#38c6b9') },
            uDeep: { value: new THREE.Color('#0b4f74') },
            uNight: { value: 0 },
          },
        ]),
      }),
    [],
  );
  const seabed = useMemo(() => seabedTexture(), []);
  const geometry = useMemo(() => {
    const g = new THREE.PlaneGeometry(1800, 1800, segments, segments);
    g.rotateX(-Math.PI / 2);
    return g;
  }, [segments]);

  useEffect(() => {
    material.uniforms.uSeabed.value = seabed;
    return () => {
      seabed.dispose();
      material.dispose();
      geometry.dispose();
    };
  }, [material, seabed, geometry]);

  useFrame(() => {
    const u = material.uniforms;
    u.uTime.value = runtime.elapsed;
    u.uSunDir.value.copy(atmosphere.sunDir);
    u.uSunColor.value.copy(atmosphere.sunColor);
    u.uSky.value.copy(atmosphere.sky);
    u.uHorizon.value.copy(atmosphere.horizon);
    u.uNight.value = runtime.nightMix;
    u.uDeep.value.setRGB(0.043, 0.31, 0.455).lerp(new THREE.Color('#041624'), runtime.nightMix);
    u.uShallow.value.setRGB(0.22, 0.776, 0.725).lerp(new THREE.Color('#0d3b45'), runtime.nightMix);
    // The sea follows the player (snapped to the grid so waves don't swim).
    if (mesh.current) {
      const step = 1800 / segments;
      mesh.current.position.set(
        Math.round(runtime.position.x / step) * step,
        0,
        Math.round(runtime.position.z / step) * step,
      );
    }
  });

  return <mesh ref={mesh} geometry={geometry} material={material} renderOrder={2} />;
}

/* ==================================================================== sky */

const skyVertex = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = normalize(position);
    vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    gl_Position = p.xyww;
  }
`;

const skyFragment = /* glsl */ `
  uniform vec3 uTop;
  uniform vec3 uHorizon;
  uniform vec3 uSunDir;
  uniform vec3 uSunColor;
  uniform float uNight;
  varying vec3 vDir;

  float hash(vec3 p) { return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }

  void main() {
    vec3 d = normalize(vDir);
    float h = clamp(d.y, -1.0, 1.0);
    vec3 col = mix(uHorizon, uTop, pow(max(h, 0.0), 0.55));
    col = mix(col, uHorizon * 0.92, smoothstep(0.0, -0.25, h));

    float sun = max(dot(d, uSunDir), 0.0);
    col += uSunColor * (pow(sun, 900.0) * 6.0 + pow(sun, 40.0) * 0.35 + pow(sun, 6.0) * 0.12) * (1.0 - uNight * 0.85);

    if (uNight > 0.01) {
      // Tiny, sparse, twinkle-free stars: a soft point inside a fine grid cell.
      vec3 g = d * 900.0;
      vec3 cell = floor(g);
      float pick = step(0.9992, hash(cell));
      float core = 1.0 - smoothstep(0.0, 0.42, length(fract(g) - 0.5));
      col += vec3(pick * core) * uNight * smoothstep(0.02, 0.3, h) * (0.5 + 0.8 * hash(cell + 3.1));
    }
    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
  }
`;

export function SkyDome() {
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: skyVertex,
        fragmentShader: skyFragment,
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
        uniforms: {
          uTop: { value: new THREE.Color() },
          uHorizon: { value: new THREE.Color() },
          uSunDir: { value: new THREE.Vector3() },
          uSunColor: { value: new THREE.Color() },
          uNight: { value: 0 },
        },
      }),
    [],
  );
  const mesh = useRef<THREE.Mesh>(null);
  const { camera } = useThree();

  useFrame(() => {
    const u = material.uniforms;
    u.uTop.value.copy(atmosphere.sky);
    u.uHorizon.value.copy(atmosphere.horizon);
    u.uSunDir.value.copy(atmosphere.sunDir);
    u.uSunColor.value.copy(atmosphere.sunColor);
    u.uNight.value = runtime.nightMix;
    mesh.current?.position.copy(camera.position);
  });

  return (
    <mesh ref={mesh} material={material} renderOrder={-10} frustumCulled={false}>
      <sphereGeometry args={[900, 32, 16]} />
    </mesh>
  );
}

/* ================================================================ clouds */

function puffTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d')!;
  for (let i = 0; i < 14; i++) {
    const x = 34 + Math.random() * 60;
    const y = 40 + Math.random() * 48;
    const r = 18 + Math.random() * 26;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, 'rgba(255,255,255,0.55)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function Clouds({ count }: { count: number }) {
  const material = useMemo(
    () => new THREE.SpriteMaterial({ map: puffTexture(), transparent: true, depthWrite: false, fog: true, opacity: 0.95 }),
    [],
  );
  const puffs = useMemo(() => {
    const out: { p: [number, number, number]; s: number }[] = [];
    let seed = 7;
    const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < count; i++) {
      const cx = (r() - 0.5) * 1300;
      const cz = (r() - 0.5) * 1300;
      const cy = 120 + r() * 70;
      const n = 6 + Math.floor(r() * 6);
      for (let k = 0; k < n; k++) {
        out.push({ p: [cx + (r() - 0.5) * 70, cy + (r() - 0.5) * 14, cz + (r() - 0.5) * 40], s: 30 + r() * 40 });
      }
    }
    return out;
  }, [count]);

  useFrame(() => {
    material.color.setScalar(1 - runtime.nightMix * 0.88);
  });

  return (
    <group>
      {puffs.map((c, i) => (
        <sprite key={i} position={c.p} scale={[c.s, c.s * 0.6, 1]} material={material} />
      ))}
    </group>
  );
}
