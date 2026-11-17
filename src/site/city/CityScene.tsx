import { Html, Line, OrbitControls } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { Bloom, EffectComposer } from '@react-three/postprocessing';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { stackLabel } from '../github';
import { districtExtent, LOBBY, PLOT, type Building, type Tier } from './plan';

const NIGHT = '#06090b';
const SIGNAL = '#ff6a2b';
const ROAD_SPAN = 46;

/* ------------------------------------------------------------------ */
/* Window texture: one 8×8 tile of lit and dark windows, shared.       */
/* ------------------------------------------------------------------ */

function makeWindows(seed = 7): THREE.CanvasTexture {
  let s = seed;
  const rand = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const size = 256;
  const cell = size / 8;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d')!;
  g.fillStyle = '#000';
  g.fillRect(0, 0, size, size);
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      const lit = rand() < 0.58;
      const v = lit ? 150 + Math.floor(rand() * 105) : 10 + Math.floor(rand() * 18);
      g.fillStyle = `rgb(${v},${v},${v})`;
      g.fillRect(x * cell + cell * 0.22, y * cell + cell * 0.2, cell * 0.56, cell * 0.58);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/* ------------------------------------------------------------------ */
/* A repo building                                                      */
/* ------------------------------------------------------------------ */

interface Look {
  active: boolean;
  dimmed: boolean;
}

function TierMesh({ tier, windows, look, index }: { tier: Tier; windows: THREE.Texture; look: Look; index: number }) {
  const mats = useMemo(() => {
    const side = (cols: number) => {
      const t = windows.clone();
      t.needsUpdate = true;
      t.repeat.set(cols / 8, tier.floors / 8);
      t.offset.set(Math.floor(Math.random() * 8) / 8, Math.floor(Math.random() * 8) / 8);
      return new THREE.MeshStandardMaterial({
        color: '#0b1114',
        roughness: 0.55,
        metalness: 0.35,
        emissive: new THREE.Color(tier.color),
        emissiveMap: t,
        emissiveIntensity: 1,
      });
    };
    const cols = Math.max(2, Math.round(tier.width / 0.42));
    const roof = new THREE.MeshStandardMaterial({ color: '#11181b', roughness: 0.9, metalness: 0.1 });
    const s = side(cols);
    return [s, s, roof, roof, s, s];
  }, [tier, windows]);

  useEffect(
    () => () => {
      (mats[0] as THREE.MeshStandardMaterial).emissiveMap?.dispose();
      mats[0].dispose();
      mats[2].dispose();
    },
    [mats],
  );

  useFrame((_, dt) => {
    const m = mats[0] as THREE.MeshStandardMaterial;
    const target = look.active ? 2.1 : look.dimmed ? 0.35 : 1;
    m.emissiveIntensity += (target - m.emissiveIntensity) * Math.min(1, dt * 6);
  });

  return (
    <mesh position={[0, tier.y + tier.height / 2, 0]} material={mats} castShadow={false} userData={{ tier: index }}>
      <boxGeometry args={[tier.width, tier.height, tier.width]} />
    </mesh>
  );
}

function Beacon({ y, color }: { y: number; color: string }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const on = Math.sin(clock.elapsedTime * 3.2) > 0.2;
    (ref.current.material as THREE.MeshBasicMaterial).opacity = on ? 1 : 0.15;
  });
  return (
    <mesh ref={ref} position={[0, y, 0]}>
      <sphereGeometry args={[0.13, 12, 12]} />
      <meshBasicMaterial color={color} transparent toneMapped={false} />
    </mesh>
  );
}

function RepoBuilding({
  b,
  index,
  windows,
  look,
  rise,
  onHover,
  onSelect,
  reduce,
}: {
  b: Building;
  index: number;
  windows: THREE.Texture;
  look: Look;
  rise: React.MutableRefObject<number>;
  onHover: (name: string | null) => void;
  onSelect: (name: string | null) => void;
  reduce: boolean;
}) {
  const group = useRef<THREE.Group>(null);
  const ring = useRef<THREE.Mesh>(null);
  const top = b.tiers[b.tiers.length - 1];
  const roofY = b.height;

  useFrame(({ clock }) => {
    // Rise out of the ground, one after another, when the section first shows.
    const g = group.current;
    if (g) {
      const k = reduce ? 1 : Math.min(1, Math.max(0, (rise.current - index * 0.12) / 1.1));
      const e = 1 - Math.pow(1 - k, 3);
      g.scale.y = Math.max(0.001, e);
    }
    if (ring.current) {
      const pulse = 1 + Math.sin(clock.elapsedTime * 2.4) * 0.04;
      ring.current.scale.setScalar(pulse);
      const m = ring.current.material as THREE.MeshBasicMaterial;
      m.opacity += ((look.active ? 0.95 : 0) - m.opacity) * 0.12;
    }
  });

  const forkRing = useMemo(() => {
    if (!b.repo.fork) return null;
    const r = PLOT * 0.42;
    return Array.from({ length: 65 }, (_, i) => {
      const a = (i / 64) * Math.PI * 2;
      return new THREE.Vector3(Math.cos(a) * r, 0.05, Math.sin(a) * r);
    });
  }, [b.repo.fork]);

  return (
    <group position={[b.x, 0, b.z]}>
      {/* Plot */}
      <mesh position={[0, 0.03, 0]} receiveShadow>
        <boxGeometry args={[PLOT * 0.8, 0.06, PLOT * 0.8]} />
        <meshStandardMaterial color="#0c1316" roughness={1} />
      </mesh>
      <lineSegments position={[0, 0.07, 0]}>
        <edgesGeometry args={[new THREE.BoxGeometry(PLOT * 0.8, 0.001, PLOT * 0.8)]} />
        <lineBasicMaterial color={b.color} transparent opacity={look.active ? 0.9 : 0.28} />
      </lineSegments>
      {forkRing && <Line points={forkRing} color="#9aa3a0" lineWidth={1} dashed dashSize={0.35} gapSize={0.25} transparent opacity={0.6} />}

      {/* Selection ring */}
      <mesh ref={ring} rotation-x={-Math.PI / 2} position={[0, 0.09, 0]}>
        <ringGeometry args={[b.width * 0.78, b.width * 0.86, 48]} />
        <meshBasicMaterial color={SIGNAL} transparent opacity={0} toneMapped={false} />
      </mesh>

      <group
        ref={group}
        onPointerOver={(e) => {
          e.stopPropagation();
          onHover(b.repo.name);
          document.body.style.cursor = 'pointer';
        }}
        onPointerOut={() => {
          onHover(null);
          document.body.style.cursor = '';
        }}
        onClick={(e) => {
          e.stopPropagation();
          onSelect(b.repo.name);
        }}
      >
        {/* Lobby: dark glass with a lit band */}
        <mesh position={[0, LOBBY / 2, 0]}>
          <boxGeometry args={[b.width * 1.02, LOBBY, b.width * 1.02]} />
          <meshStandardMaterial color="#0e1518" roughness={0.3} metalness={0.6} emissive={b.color} emissiveIntensity={0.12} />
        </mesh>
        <mesh position={[0, LOBBY - 0.04, 0]}>
          <boxGeometry args={[b.width * 1.05, 0.05, b.width * 1.05]} />
          <meshBasicMaterial color={b.color} toneMapped={false} />
        </mesh>
        {b.tiers.map((t, i) => (
          <TierMesh key={t.lang} tier={t} windows={windows} look={look} index={i} />
        ))}
        {/* Roof: plant boxes, and an antenna on the tall ones */}
        <mesh position={[top.width * 0.18, roofY + 0.14, -top.width * 0.15]}>
          <boxGeometry args={[top.width * 0.3, 0.28, top.width * 0.26]} />
          <meshStandardMaterial color="#1a2226" roughness={0.8} />
        </mesh>
        <mesh position={[-top.width * 0.2, roofY + 0.1, top.width * 0.2]}>
          <boxGeometry args={[top.width * 0.22, 0.2, top.width * 0.22]} />
          <meshStandardMaterial color="#161d21" roughness={0.8} />
        </mesh>
        {b.height > 4 && (
          <mesh position={[0, roofY + 0.9, 0]}>
            <cylinderGeometry args={[0.03, 0.05, 1.8, 6]} />
            <meshStandardMaterial color="#3a4448" />
          </mesh>
        )}
        {b.recent && <Beacon y={roofY + (b.height > 4 ? 1.85 : 0.45)} color={SIGNAL} />}
      </group>

      <Html position={[0, roofY + (b.height > 4 ? 2.6 : 1.3), 0]} center zIndexRange={[20, 0]} className="city-label-wrap">
        <button
          type="button"
          className={`city-label ${look.active ? 'is-active' : ''} ${look.dimmed ? 'is-dimmed' : ''}`}
          onPointerEnter={() => onHover(b.repo.name)}
          onPointerLeave={() => onHover(null)}
          onClick={() => onSelect(b.repo.name)}
          tabIndex={-1}
        >
          <span className="city-label__dot" style={{ background: b.color }} />
          {b.repo.name}
          <span className="city-label__meta">{stackLabel(b.repo)}</span>
        </button>
      </Html>
    </group>
  );
}

/* ------------------------------------------------------------------ */
/* The rest of the city: background blocks, roads, traffic              */
/* ------------------------------------------------------------------ */

function Skyline({ extent, windows, radius }: { extent: number; windows: THREE.Texture; radius: number }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const items = useMemo(() => {
    let s = 11;
    const rand = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    const out: { x: number; z: number; w: number; d: number; h: number; tone: number }[] = [];
    const blocks = Math.ceil(radius / PLOT) + 1;
    for (let bx = -blocks; bx <= blocks; bx++) {
      for (let bz = -blocks; bz <= blocks; bz++) {
        for (const [ox, oz] of [
          [-1, -1],
          [1, -1],
          [-1, 1],
          [1, 1],
        ]) {
          const x = bx * PLOT + ox * PLOT * 0.22;
          const z = bz * PLOT + oz * PLOT * 0.22;
          if (Math.abs(x) < extent + 0.6 && Math.abs(z) < extent + 0.6) continue;
          const dist = Math.hypot(x, z);
          if (dist > radius || rand() < 0.22) continue;
          const far = Math.min(1, Math.max(0, (dist - extent) / (radius - extent)));
          out.push({
            x,
            z,
            w: 1.2 + rand() * 1.3,
            d: 1.2 + rand() * 1.3,
            h: 0.4 + rand() * 1.6 + far * far * rand() * 9,
            tone: 0.5 + rand() * 0.5,
          });
        }
      }
    }
    return out;
  }, [extent, radius]);

  const material = useMemo(() => {
    const t = windows.clone();
    t.needsUpdate = true;
    t.repeat.set(0.4, 0.6);
    return new THREE.MeshStandardMaterial({
      color: '#0b1013',
      roughness: 0.8,
      metalness: 0.2,
      emissive: '#d8c7a6',
      emissiveMap: t,
      emissiveIntensity: 0.22,
    });
  }, [windows]);

  useEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const m = new THREE.Matrix4();
    const c = new THREE.Color();
    items.forEach((it, i) => {
      m.compose(new THREE.Vector3(it.x, it.h / 2, it.z), new THREE.Quaternion(), new THREE.Vector3(it.w, it.h, it.d));
      mesh.setMatrixAt(i, m);
      mesh.setColorAt(i, c.setScalar(it.tone));
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [items]);

  useEffect(
    () => () => {
      material.emissiveMap?.dispose();
      material.dispose();
    },
    [material],
  );

  return (
    <instancedMesh ref={ref} args={[undefined, material, items.length]} raycast={() => null}>
      <boxGeometry />
    </instancedMesh>
  );
}

function Roads({ radius }: { radius: number }) {
  const geo = useMemo(() => {
    const pts: number[] = [];
    const n = Math.ceil(radius / PLOT);
    for (let k = -n; k < n; k++) {
      const c = (k + 0.5) * PLOT;
      pts.push(c, 0.02, -radius, c, 0.02, radius);
      pts.push(-radius, 0.02, c, radius, 0.02, c);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    return g;
  }, [radius]);
  useEffect(() => () => geo.dispose(), [geo]);
  return (
    <lineSegments geometry={geo} raycast={() => null}>
      <lineBasicMaterial color="#2a3438" transparent opacity={0.55} />
    </lineSegments>
  );
}

function Traffic({ count, radius, reduce }: { count: number; radius: number; reduce: boolean }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const cars = useMemo(() => {
    const n = Math.ceil(radius / PLOT);
    return Array.from({ length: count }, (_, i) => {
      const axis = i % 2; // 0: runs along z, 1: runs along x
      const lane = Math.floor(Math.random() * 2 * n) - n;
      const dir = Math.random() < 0.5 ? 1 : -1;
      return {
        axis,
        c: (lane + 0.5) * PLOT + dir * 0.32,
        dir,
        speed: 2.2 + Math.random() * 3.2,
        off: Math.random() * radius * 2,
        warm: dir > 0,
      };
    });
  }, [count, radius]);

  const material = useMemo(() => new THREE.MeshBasicMaterial({ toneMapped: false }), []);
  useEffect(() => () => material.dispose(), [material]);

  useEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const col = new THREE.Color();
    cars.forEach((car, i) => mesh.setColorAt(i, col.set(car.warm ? '#ffe2b8' : SIGNAL)));
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [cars]);

  const m = useMemo(() => new THREE.Matrix4(), []);
  const q0 = useMemo(() => new THREE.Quaternion(), []);
  const q1 = useMemo(() => new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2), []);
  const p = useMemo(() => new THREE.Vector3(), []);
  const sc = useMemo(() => new THREE.Vector3(0.12, 0.07, 0.42), []);

  useFrame(({ clock }) => {
    const mesh = ref.current;
    if (!mesh) return;
    const t = reduce ? 0 : clock.elapsedTime;
    const span = radius * 2;
    cars.forEach((car, i) => {
      let s = (car.off + car.dir * car.speed * t) % span;
      if (s < 0) s += span;
      const along = s - radius;
      if (car.axis === 0) p.set(car.c, 0.08, along);
      else p.set(along, 0.08, car.c);
      m.compose(p, car.axis === 0 ? q0 : q1, sc);
      mesh.setMatrixAt(i, m);
    });
    mesh.instanceMatrix.needsUpdate = true;
  });

  return <instancedMesh ref={ref} args={[undefined, material, count]} raycast={() => null}><boxGeometry /></instancedMesh>;
}

/* ------------------------------------------------------------------ */
/* Camera: slow orbit; glides to a selected building                    */
/* ------------------------------------------------------------------ */

/** Camera distance from the district's centre. Portrait frames (phones) stand further back to fit its width. */
function frameDistance(extent: number, aspect: number): number {
  return (extent * 1.55 + 13) * (aspect < 1.2 ? 1 + (1.2 - aspect) * 0.85 : 1);
}

function Rig({
  focus,
  extent,
  top,
  interactive,
  paused,
  cardOpen,
}: {
  focus: Building | null;
  extent: number;
  top: number;
  interactive: boolean;
  paused: boolean;
  cardOpen: boolean;
}) {
  const controls = useRef<OrbitControlsImpl>(null);
  const { camera, size } = useThree();
  const target = useMemo(() => new THREE.Vector3(), []);
  const shift = useRef(0);
  const rest = Math.min(top * 0.38, 5);
  // Re-frame on real shape changes only, not every pixel of a resize.
  const aspectStep = Math.round((size.width / Math.max(1, size.height)) * 10);

  useEffect(() => {
    // Close enough that the towers fill the frame, high enough that none hides another.
    const d = frameDistance(extent, aspectStep / 10);
    camera.position.set(d * 0.62, d * 0.78, d * 0.82);
    camera.lookAt(0, rest, 0);
  }, [camera, extent, rest, aspectStep]);

  useFrame((_, dt) => {
    const c = controls.current;
    if (!c) return;
    if (focus) target.set(focus.x, Math.min(focus.height * 0.55, 4), focus.z);
    else target.set(0, rest, 0);
    c.target.lerp(target, Math.min(1, dt * 2.5));
    c.autoRotate = !paused;
    c.update();

    // On wide views the info card covers the right side: slide the picture left to keep the building clear.
    const want = cardOpen && size.width > 820 ? Math.min(200, size.width * 0.19) : 0;
    shift.current += (want - shift.current) * Math.min(1, dt * 5);
    const cam = camera as THREE.PerspectiveCamera;
    if (Math.abs(shift.current) > 0.5) cam.setViewOffset(size.width, size.height, shift.current, 0, size.width, size.height);
    else if (cam.view?.enabled) cam.clearViewOffset();
  });

  return (
    <OrbitControls
      ref={controls}
      makeDefault
      enablePan={false}
      enableZoom={false}
      enableRotate={interactive}
      enableDamping
      dampingFactor={0.08}
      autoRotate
      autoRotateSpeed={0.45}
      minPolarAngle={0.45}
      maxPolarAngle={1.32}
    />
  );
}

/* ------------------------------------------------------------------ */

export interface CitySceneProps {
  buildings: Building[];
  hovered: string | null;
  selected: string | null;
  onHover: (name: string | null) => void;
  onSelect: (name: string | null) => void;
  started: boolean;
  high: boolean;
  interactive: boolean;
  reduce: boolean;
}

export function CityScene({ buildings, hovered, selected, onHover, onSelect, started, high, interactive, reduce }: CitySceneProps) {
  const windows = useMemo(() => makeWindows(), []);
  useEffect(() => () => windows.dispose(), [windows]);
  const extent = useMemo(() => districtExtent(buildings), [buildings]);
  const radius = high ? ROAD_SPAN : 32;
  const rise = useRef(0);
  const size = useThree((st) => st.size);
  // Camera-to-centre distance (the 1.29 is the length of the camera's direction vector below).
  const dist = frameDistance(extent, Math.round((size.width / Math.max(1, size.height)) * 10) / 10) * 1.29;
  const focusName = selected ?? hovered;
  const focus = buildings.find((b) => b.repo.name === selected) ?? null;
  const top = useMemo(() => Math.max(...buildings.map((b) => b.height)), [buildings]);

  useFrame((_, dt) => {
    if (started) rise.current += dt;
  });

  return (
    <>
      <color attach="background" args={[NIGHT]} />
      <fog attach="fog" args={[NIGHT, dist * 0.8, dist * 2]} />
      <ambientLight intensity={0.45} />
      <hemisphereLight args={['#5f8590', '#090c0d', 0.7]} />
      <directionalLight position={[18, 30, 12]} intensity={0.7} color="#c7d6dc" />
      <pointLight position={[0, 1.5, 0]} intensity={8} distance={extent * 2.2} color={SIGNAL} decay={1.6} />

      <mesh rotation-x={-Math.PI / 2} position={[0, 0, 0]} receiveShadow raycast={() => null}>
        <planeGeometry args={[radius * 4, radius * 4]} />
        <meshStandardMaterial color="#080c0e" roughness={0.95} />
      </mesh>
      <Roads radius={radius} />
      <Skyline extent={extent} windows={windows} radius={radius} />
      <Traffic count={high ? 90 : 40} radius={radius} reduce={reduce} />

      {buildings.map((b, i) => (
        <RepoBuilding
          key={b.repo.name}
          b={b}
          index={i}
          windows={windows}
          look={{ active: focusName === b.repo.name, dimmed: focusName !== null && focusName !== b.repo.name }}
          rise={rise}
          onHover={onHover}
          onSelect={onSelect}
          reduce={reduce}
        />
      ))}

      <Rig
        focus={focus}
        extent={extent}
        top={top}
        interactive={interactive}
        paused={reduce || focusName !== null}
        cardOpen={selected !== null}
      />

      {high && (
        <EffectComposer multisampling={0}>
          <Bloom mipmapBlur intensity={0.85} luminanceThreshold={0.55} luminanceSmoothing={0.2} radius={0.7} />
        </EffectComposer>
      )}
    </>
  );
}
