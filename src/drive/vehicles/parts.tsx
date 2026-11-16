import { useMemo } from 'react';
import * as THREE from 'three';

/**
 * Shared materials and small building blocks for the vehicle models.
 * Materials are module singletons: five vehicles, one set of shader programs.
 */

export const MAT = {
  rubber: new THREE.MeshStandardMaterial({ color: '#111214', roughness: 0.92, metalness: 0 }),
  tread: new THREE.MeshStandardMaterial({ color: '#1a1b1e', roughness: 0.85, metalness: 0 }),
  rim: new THREE.MeshStandardMaterial({ color: '#c9ced6', roughness: 0.22, metalness: 0.95 }),
  darkRim: new THREE.MeshStandardMaterial({ color: '#2a2d33', roughness: 0.3, metalness: 0.85 }),
  chrome: new THREE.MeshStandardMaterial({ color: '#e6e9ee', roughness: 0.08, metalness: 1 }),
  plastic: new THREE.MeshStandardMaterial({ color: '#16181c', roughness: 0.55, metalness: 0.1 }),
  trim: new THREE.MeshStandardMaterial({ color: '#0d0e10', roughness: 0.35, metalness: 0.4 }),
  metal: new THREE.MeshStandardMaterial({ color: '#7d838c', roughness: 0.35, metalness: 0.85 }),
  brakeDisc: new THREE.MeshStandardMaterial({ color: '#8b8f96', roughness: 0.4, metalness: 0.9 }),
  caliper: new THREE.MeshStandardMaterial({ color: '#66e0c0', roughness: 0.35, metalness: 0.3 }),
  glass: new THREE.MeshPhysicalMaterial({
    color: '#0a121b',
    roughness: 0.04,
    metalness: 0.6,
    clearcoat: 1,
    clearcoatRoughness: 0.02,
    envMapIntensity: 1.6,
  }),
  clearGlass: new THREE.MeshPhysicalMaterial({
    color: '#9fc6dd',
    roughness: 0.03,
    metalness: 0.1,
    transparent: true,
    opacity: 0.32,
    envMapIntensity: 1.8,
    depthWrite: false,
  }),
  headlight: new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#fff6e0', emissiveIntensity: 2.2, roughness: 0.1 }),
  lens: new THREE.MeshPhysicalMaterial({ color: '#dfe8f0', roughness: 0.02, metalness: 0.3, clearcoat: 1, transparent: true, opacity: 0.55 }),
  tail: new THREE.MeshStandardMaterial({ color: '#2a0303', emissive: '#ff1a1a', emissiveIntensity: 1.2, roughness: 0.25 }),
  amber: new THREE.MeshStandardMaterial({ color: '#3a2000', emissive: '#ffa21a', emissiveIntensity: 1.4, roughness: 0.3 }),
  navRed: new THREE.MeshStandardMaterial({ color: '#330000', emissive: '#ff2020', emissiveIntensity: 3 }),
  navGreen: new THREE.MeshStandardMaterial({ color: '#003300', emissive: '#20ff60', emissiveIntensity: 3 }),
  strobe: new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#ffffff', emissiveIntensity: 0 }),
  seat: new THREE.MeshStandardMaterial({ color: '#1d1f24', roughness: 0.75, metalness: 0 }),
  leather: new THREE.MeshStandardMaterial({ color: '#c9b79a', roughness: 0.7, metalness: 0 }),
  teak: new THREE.MeshStandardMaterial({ color: '#a2774c', roughness: 0.65, metalness: 0 }),
  suit: new THREE.MeshStandardMaterial({ color: '#1b1e24', roughness: 0.7, metalness: 0.05 }),
  suitAccent: new THREE.MeshStandardMaterial({ color: '#66e0c0', roughness: 0.5, metalness: 0.1 }),
  visor: new THREE.MeshPhysicalMaterial({ color: '#05080c', roughness: 0.05, metalness: 0.9, clearcoat: 1 }),
};

/** Car-paint: metallic base under a glossy clearcoat. */
export function paint(color: string, metalness = 0.55) {
  return new THREE.MeshPhysicalMaterial({
    color,
    metalness,
    roughness: 0.32,
    clearcoat: 1,
    clearcoatRoughness: 0.06,
    envMapIntensity: 1.25,
  });
}

/** A capsule spanning two points — limbs, struts, tubes. */
export function Limb({
  from,
  to,
  radius,
  material,
  capsule = true,
}: {
  from: [number, number, number];
  to: [number, number, number];
  radius: number;
  material: THREE.Material;
  capsule?: boolean;
}) {
  const { position, quaternion, length } = useMemo(() => {
    const a = new THREE.Vector3(...from);
    const b = new THREE.Vector3(...to);
    const dir = b.clone().sub(a);
    const len = dir.length();
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
    return { position: a.add(b).multiplyScalar(0.5), quaternion: q, length: len };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from.join(), to.join()]);

  return (
    <mesh position={position} quaternion={quaternion} material={material} castShadow>
      {capsule ? (
        <capsuleGeometry args={[radius, Math.max(0.001, length), 4, 10]} />
      ) : (
        <cylinderGeometry args={[radius, radius, length, 10]} />
      )}
    </mesh>
  );
}

/** Road wheel: tyre with sidewall bulge, multi-spoke rim, disc and hub. Spins about X. */
export function Wheel({
  radius,
  width,
  spokes = 5,
  rim = MAT.rim,
  disc = true,
  side = 1,
}: {
  radius: number;
  width: number;
  spokes?: number;
  rim?: THREE.Material;
  disc?: boolean;
  /** +1 for the left (+X) side, -1 for the right: rim faces outward. */
  side?: 1 | -1;
}) {
  const tyre = useMemo(() => {
    // Lathe a tyre cross-section so the sidewall has a real rounded profile.
    const pts: THREE.Vector2[] = [];
    const inner = radius * 0.64;
    const hw = width / 2;
    const steps = 10;
    pts.push(new THREE.Vector2(inner, -hw * 0.9));
    for (let i = 0; i <= steps; i++) {
      const a = -Math.PI / 2 + (i / steps) * Math.PI;
      pts.push(new THREE.Vector2(radius - hw * 0.35 + Math.cos(a) * hw * 0.35, Math.sin(a) * hw));
    }
    pts.push(new THREE.Vector2(inner, hw * 0.9));
    const g = new THREE.LatheGeometry(pts, 36);
    g.rotateZ(Math.PI / 2);
    return g;
  }, [radius, width]);

  const rimR = radius * 0.66;
  const face = (width / 2) * 0.55 * side;

  return (
    <group>
      <mesh geometry={tyre} material={MAT.rubber} castShadow />
      {/* rim barrel */}
      <mesh rotation={[0, 0, Math.PI / 2]} material={MAT.darkRim}>
        <cylinderGeometry args={[rimR, rimR, width * 0.82, 28, 1, true]} />
      </mesh>
      {/* rim lip */}
      <mesh position={[face, 0, 0]} rotation={[0, Math.PI / 2, 0]} material={rim}>
        <torusGeometry args={[rimR * 0.97, rimR * 0.05, 8, 32]} />
      </mesh>
      {/* spokes */}
      {Array.from({ length: spokes }, (_, i) => {
        const a = (i / spokes) * Math.PI * 2;
        return (
          <mesh
            key={i}
            position={[face * 0.9, Math.cos(a) * rimR * 0.5, Math.sin(a) * rimR * 0.5]}
            rotation={[a, 0, 0]}
            material={rim}
          >
            <boxGeometry args={[width * 0.12, rimR * 0.92, rimR * 0.2]} />
          </mesh>
        );
      })}
      {/* hub */}
      <mesh position={[face * 0.95, 0, 0]} rotation={[0, 0, Math.PI / 2]} material={rim}>
        <cylinderGeometry args={[rimR * 0.2, rimR * 0.24, width * 0.16, 16]} />
      </mesh>
      {disc && (
        <mesh position={[face * 0.2, 0, 0]} rotation={[0, 0, Math.PI / 2]} material={MAT.brakeDisc}>
          <cylinderGeometry args={[rimR * 0.78, rimR * 0.78, 0.03, 24]} />
        </mesh>
      )}
    </group>
  );
}

/** Soft contact shadow under a vehicle — grounds it even without shadow maps. */
let blobTexture: THREE.Texture | null = null;
function getBlobTexture() {
  if (blobTexture) return blobTexture;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(64, 64, 4, 64, 64, 64);
  g.addColorStop(0, 'rgba(0,0,0,0.75)');
  g.addColorStop(0.55, 'rgba(0,0,0,0.35)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  blobTexture = new THREE.CanvasTexture(c);
  return blobTexture;
}

export function ContactShadow({ width, length, opacity = 0.7 }: { width: number; length: number; opacity?: number }) {
  const material = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        map: getBlobTexture(),
        transparent: true,
        depthWrite: false,
        opacity,
        polygonOffset: true,
        polygonOffsetFactor: -4,
      }),
    [opacity],
  );
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]} material={material} renderOrder={1}>
      <planeGeometry args={[width, length]} />
    </mesh>
  );
}

/** Forward-facing spot light whose target travels with the vehicle. */
export function HeadBeam({
  position,
  distance = 55,
  intensity = 60,
  angle = 0.55,
}: {
  position: [number, number, number];
  distance?: number;
  intensity?: number;
  angle?: number;
}) {
  const target = useMemo(() => new THREE.Object3D(), []);
  return (
    <>
      <primitive object={target} position={[position[0], position[1] - 1.6, position[2] + 14]} />
      <spotLight
        position={position}
        target={target}
        angle={angle}
        penumbra={0.6}
        distance={distance}
        intensity={intensity}
        decay={1.2}
        color="#fff2d6"
      />
    </>
  );
}
