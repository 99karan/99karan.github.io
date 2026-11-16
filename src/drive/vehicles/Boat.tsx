import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { RoundedBox } from '@react-three/drei';
import * as THREE from 'three';
import { HeadBeam, Limb, MAT, paint } from './parts';
import type { BoatSim } from './sims';
import { runtime } from '../state';

/**
 * Centre-console speedboat. The hull is lofted from cross-sections — a deep V
 * at the transom easing to a fine entry at the bow — so it sits in the water
 * and catches light like a real hull rather than a box.
 */

const STERN = -3.0;
const LENGTH = 6.7;
const SECTIONS = 28;

interface Section {
  z: number;
  w: number;
  sheer: number;
  chine: number;
  keel: number;
}

function section(t: number): Section {
  const bow = Math.max(0, (t - 0.5) / 0.5);
  const w = 1.2 * Math.sqrt(Math.max(0, 1 - bow * bow * bow * 1.0)) * (t > 0.995 ? 0 : 1);
  return {
    z: STERN + LENGTH * t,
    w: Math.max(0.0001, w),
    sheer: 0.78 + 0.32 * Math.pow(t, 2.4),
    keel: -0.36 + 0.62 * Math.pow(t, 3),
    chine: -0.08 + 0.42 * Math.pow(t, 2.6),
  };
}

function useHull() {
  return useMemo(() => {
    const ring = 7; // deckL, sideL, chineL, keel, chineR, sideR, deckR
    const positions: number[] = [];
    const colors: number[] = [];
    const white = new THREE.Color('#f3f4f6');
    const stripe = new THREE.Color('#0f7f71');
    const bottom = new THREE.Color('#1a2433');
    const sections: Section[] = [];
    for (let i = 0; i <= SECTIONS; i++) sections.push(section(i / SECTIONS));

    for (const s of sections) {
      const pts: [number, number, THREE.Color][] = [
        [s.w, s.sheer, white],
        [s.w * 0.99, s.sheer * 0.45 + s.chine * 0.55, stripe],
        [s.w * 0.86, s.chine, bottom],
        [0, s.keel, bottom],
        [-s.w * 0.86, s.chine, bottom],
        [-s.w * 0.99, s.sheer * 0.45 + s.chine * 0.55, stripe],
        [-s.w, s.sheer, white],
      ];
      for (const [x, y, c] of pts) {
        positions.push(x, y, s.z);
        colors.push(c.r, c.g, c.b);
      }
    }
    const index: number[] = [];
    for (let i = 0; i < SECTIONS; i++) {
      for (let j = 0; j < ring - 1; j++) {
        const a = i * ring + j;
        const b = a + ring;
        index.push(a, a + 1, b, a + 1, b + 1, b);
      }
    }
    const hull = new THREE.BufferGeometry();
    hull.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    hull.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    hull.setIndex(index);
    hull.computeVertexNormals();

    // Deck: a strip between the two sheer lines.
    const deckPos: number[] = [];
    const deckIdx: number[] = [];
    sections.forEach((s, i) => {
      deckPos.push(s.w, s.sheer, s.z, -s.w, s.sheer, s.z);
      if (i < sections.length - 1) {
        const a = i * 2;
        deckIdx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
      }
    });
    const deck = new THREE.BufferGeometry();
    deck.setAttribute('position', new THREE.Float32BufferAttribute(deckPos, 3));
    deck.setIndex(deckIdx);
    deck.computeVertexNormals();

    // Transom.
    const s0 = sections[0];
    const tShape = new THREE.Shape();
    tShape.moveTo(s0.w, s0.sheer);
    tShape.lineTo(s0.w * 0.99, s0.sheer * 0.45 + s0.chine * 0.55);
    tShape.lineTo(s0.w * 0.86, s0.chine);
    tShape.lineTo(0, s0.keel);
    tShape.lineTo(-s0.w * 0.86, s0.chine);
    tShape.lineTo(-s0.w * 0.99, s0.sheer * 0.45 + s0.chine * 0.55);
    tShape.lineTo(-s0.w, s0.sheer);
    const transom = new THREE.ShapeGeometry(tShape);
    transom.translate(0, 0, STERN);

    // Rub rails along the sheer.
    const rail = (side: number) =>
      new THREE.TubeGeometry(
        new THREE.CatmullRomCurve3(sections.map((s) => new THREE.Vector3(side * (s.w + 0.02), s.sheer, s.z))),
        48,
        0.045,
        6,
      );

    return { hull, deck, transom, railL: rail(1), railR: rail(-1), sections };
  }, []);
}

export function BoatModel({ sim }: { sim: BoatSim }) {
  const hull = useHull();
  const motor = useRef<THREE.Group>(null);
  const prop = useRef<THREE.Group>(null);
  const beam = useRef<THREE.Group>(null);

  const mats = useMemo(() => {
    const hullMat = new THREE.MeshPhysicalMaterial({
      vertexColors: true,
      roughness: 0.25,
      clearcoat: 1,
      clearcoatRoughness: 0.08,
      side: THREE.DoubleSide,
    });
    const deckMat = new THREE.MeshStandardMaterial({ color: '#e9e6df', roughness: 0.6, side: THREE.DoubleSide });
    const white = paint('#f3f4f6', 0.1);
    white.side = THREE.DoubleSide;
    const engine = paint('#15171b', 0.4);
    return { hullMat, deckMat, white, engine };
  }, []);

  useFrame((_, dt) => {
    if (motor.current) motor.current.rotation.x = THREE.MathUtils.lerp(motor.current.rotation.x, -0.08 - sim.planing * 0.1, 1 - Math.exp(-3 * dt));
    if (prop.current) prop.current.rotation.z += (6 + sim.rpm * 60) * dt;
    if (beam.current) beam.current.visible = runtime.nightMix > 0.35;
  });

  const windscreenZ = 0.6;

  return (
    <group>
      <mesh geometry={hull.hull} material={mats.hullMat} castShadow />
      <mesh geometry={hull.deck} material={mats.deckMat} position={[0, -0.001, 0]} receiveShadow />
      <mesh geometry={hull.transom} material={mats.white} />
      <mesh geometry={hull.railL} material={MAT.trim} />
      <mesh geometry={hull.railR} material={MAT.trim} />

      {/* cockpit sole + teak strip */}
      <RoundedBox args={[1.9, 0.08, 3.0]} radius={0.03} position={[0, 0.8, -1.2]} material={MAT.teak} receiveShadow />

      {/* console + wraparound screen */}
      <RoundedBox args={[0.9, 0.62, 0.62]} radius={0.12} position={[0, 1.12, 0.35]} material={mats.white} castShadow />
      <mesh position={[0, 1.55, windscreenZ - 0.85]} rotation={[-0.25, 0, 0]} material={MAT.clearGlass}>
        <cylinderGeometry args={[0.95, 1.0, 0.4, 32, 1, true, -0.85, 1.7]} />
      </mesh>
      <mesh position={[0.18, 1.48, 0.12]} rotation={[-0.9, 0, 0]} material={MAT.trim}>
        <torusGeometry args={[0.14, 0.018, 8, 24]} />
      </mesh>
      <mesh position={[-0.18, 1.44, 0.18]} rotation={[-0.9, 0, 0]} material={MAT.plastic}>
        <planeGeometry args={[0.24, 0.16]} />
      </mesh>

      {/* seats */}
      {[0.48, -0.48].map((x) => (
        <group key={x} position={[x, 0.84, -0.45]}>
          <RoundedBox args={[0.55, 0.22, 0.55]} radius={0.08} position={[0, 0.15, 0]} material={MAT.leather} />
          <RoundedBox args={[0.55, 0.55, 0.16]} radius={0.07} position={[0, 0.45, -0.25]} rotation={[-0.15, 0, 0]} material={MAT.leather} />
        </group>
      ))}
      <RoundedBox args={[1.9, 0.3, 0.6]} radius={0.1} position={[0, 1.0, -2.45]} material={MAT.leather} />

      {/* bow rail */}
      {[1, -1].map((s) => (
        <group key={s}>
          <Limb from={[s * 0.75, 1.25, 2.0]} to={[s * 0.2, 1.33, 3.35]} radius={0.02} material={MAT.chrome} />
          <Limb from={[s * 0.75, 1.0, 2.0]} to={[s * 0.75, 1.25, 2.0]} radius={0.018} material={MAT.chrome} />
        </group>
      ))}
      <mesh position={[0.62, 1.07, 2.7]} material={MAT.navRed}>
        <sphereGeometry args={[0.045, 8, 6]} />
      </mesh>
      <mesh position={[-0.62, 1.07, 2.7]} material={MAT.navGreen}>
        <sphereGeometry args={[0.045, 8, 6]} />
      </mesh>

      {/* outboard */}
      <group position={[0, 0.9, STERN - 0.12]}>
        <group ref={motor}>
          <RoundedBox args={[0.55, 0.7, 0.62]} radius={0.16} position={[0, 0.3, -0.25]} material={mats.engine} castShadow />
          <mesh position={[0, 0.3, -0.25]} material={MAT.suitAccent}>
            <boxGeometry args={[0.57, 0.06, 0.4]} />
          </mesh>
          <mesh position={[0, -0.45, -0.3]} material={mats.engine}>
            <boxGeometry args={[0.14, 1.0, 0.24]} />
          </mesh>
          <group position={[0, -0.95, -0.42]}>
            <group ref={prop}>
              {[0, 1, 2].map((i) => (
                <mesh key={i} rotation={[0, 0, (i / 3) * Math.PI * 2]} position={[0, 0, 0]} material={MAT.metal}>
                  <boxGeometry args={[0.06, 0.3, 0.02]} />
                </mesh>
              ))}
            </group>
          </group>
        </group>
      </group>

      <group ref={beam} visible={false}>
        <HeadBeam position={[0, 1.2, 3.2]} intensity={50} />
      </group>
    </group>
  );
}
