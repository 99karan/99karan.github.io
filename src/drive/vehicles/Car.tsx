import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { RoundedBox } from '@react-three/drei';
import * as THREE from 'three';
import { ContactShadow, HeadBeam, MAT, paint, Wheel } from './parts';
import type { GroundSim } from './sims';
import { runtime } from '../state';
import { CAR_PARAMS } from './sims';

/**
 * A two-door GT coupé, built from its side silhouette.
 *
 * The body is one extruded profile with wheel arches cut into it; the glass
 * house is a narrower extrusion on top, which gives the tumblehome a real car
 * has. Everything else — lamps, grille, mirrors, diffuser — is detail.
 */

const L = 2.28; // half length
const AXLE = CAR_PARAMS.wheelBase / 2;
const TRACK = 0.84;
/** The extrusion bevel grows the body outward; surface details sit this far further out. */
const B = 0.09;
const WHEEL_R = CAR_PARAMS.wheelRadius;

function profile(build: (s: THREE.Shape) => void) {
  const s = new THREE.Shape();
  build(s);
  return s;
}

function extrude(shape: THREE.Shape, width: number, bevel: number, curveSegments = 24) {
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: width - bevel * 2,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 4,
    curveSegments,
  });
  g.translate(0, 0, -(width - bevel * 2) / 2);
  // Shape X runs along the car; the extrusion runs across it.
  g.rotateY(-Math.PI / 2);
  g.computeVertexNormals();
  return g;
}

function useCarGeometry() {
  return useMemo(() => {
    const archR = 0.47;
    const body = profile((s) => {
      s.moveTo(L - 0.04, 0.3);
      s.quadraticCurveTo(L + 0.06, 0.34, L + 0.05, 0.52);
      s.quadraticCurveTo(L + 0.02, 0.68, L - 0.16, 0.72);
      s.quadraticCurveTo(1.2, 0.84, 0.72, 0.94);
      s.lineTo(-1.42, 0.97);
      s.quadraticCurveTo(-1.9, 0.98, -2.12, 0.95);
      s.quadraticCurveTo(-L - 0.04, 0.9, -L - 0.02, 0.62);
      s.quadraticCurveTo(-L, 0.34, -L + 0.12, 0.27);
      s.lineTo(-AXLE - archR - 0.02, 0.27);
      s.absarc(-AXLE, 0.33, archR, Math.PI + 0.13, -0.13, true);
      s.lineTo(AXLE - archR - 0.02, 0.27);
      s.absarc(AXLE, 0.33, archR, Math.PI + 0.13, -0.13, true);
      s.lineTo(L - 0.04, 0.3);
    });

    const glass = profile((s) => {
      s.moveTo(0.78, 0.9);
      s.quadraticCurveTo(0.3, 1.16, -0.08, 1.3);
      s.quadraticCurveTo(-0.5, 1.37, -0.92, 1.33);
      s.quadraticCurveTo(-1.3, 1.2, -1.58, 0.94);
      s.lineTo(0.78, 0.9);
    });

    const roof = profile((s) => {
      s.moveTo(0.02, 1.27);
      s.quadraticCurveTo(-0.45, 1.375, -0.94, 1.325);
      s.lineTo(-0.9, 1.29);
      s.quadraticCurveTo(-0.45, 1.335, -0.02, 1.25);
      s.lineTo(0.02, 1.27);
    });

    const sill = profile((s) => {
      s.moveTo(AXLE - 0.5, 0.27);
      s.lineTo(-AXLE + 0.5, 0.27);
      s.lineTo(-AXLE + 0.5, 0.36);
      s.lineTo(AXLE - 0.5, 0.36);
    });

    return {
      body: extrude(body, 1.9, 0.09),
      glass: extrude(glass, 1.5, 0.06),
      roof: extrude(roof, 1.48, 0.03),
      sill: extrude(sill, 1.94, 0.02, 2),
    };
  }, []);
}

let plateTexture: THREE.Texture | null = null;
function getPlate() {
  if (plateTexture) return plateTexture;
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 64;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#f2f2ee';
  ctx.fillRect(0, 0, 256, 64);
  ctx.fillStyle = '#1144aa';
  ctx.fillRect(0, 0, 22, 64);
  ctx.fillStyle = '#111';
  ctx.font = '700 40px "JetBrains Mono", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('KARAN 99', 140, 34);
  plateTexture = new THREE.CanvasTexture(c);
  plateTexture.colorSpace = THREE.SRGBColorSpace;
  return plateTexture;
}

export const CAR_PAINTS = ['#0f7f71', '#c8102e', '#f2f2f0', '#14161a', '#e8a33d', '#2c4fd6'];

export function CarModel({ sim, paintIndex = 0 }: { sim: GroundSim; paintIndex?: number }) {
  const geo = useCarGeometry();
  const body = useRef<THREE.Group>(null);
  const wheels = useRef<(THREE.Group | null)[]>([]);
  const steerers = useRef<(THREE.Group | null)[]>([]);
  const lights = useRef<THREE.Group>(null);

  const bodyPaint = useMemo(() => paint(CAR_PAINTS[paintIndex % CAR_PAINTS.length]), [paintIndex]);
  const tail = useMemo(() => MAT.tail.clone(), []);
  const head = useMemo(() => MAT.headlight.clone(), []);
  const plate = useMemo(() => new THREE.MeshStandardMaterial({ map: getPlate(), roughness: 0.5 }), []);

  useFrame(() => {
    if (body.current) {
      body.current.rotation.x = sim.bodyPitch;
      body.current.rotation.z = sim.bodyRoll;
      body.current.position.y = sim.bodyHeave;
    }
    for (let i = 0; i < 4; i++) {
      const w = wheels.current[i];
      if (w) w.rotation.x = sim.wheelSpin;
    }
    for (const s of steerers.current) if (s) s.rotation.y = -sim.steer;

    const night = runtime.nightMix;
    tail.emissiveIntensity = sim.braking ? 4.5 : 0.9 + night * 1.2;
    head.emissiveIntensity = 1.6 + night * 3;
    if (lights.current) lights.current.visible = night > 0.35;
  });

  const wheelPos: [number, number, number, 1 | -1, boolean][] = [
    [TRACK, WHEEL_R, AXLE, 1, true],
    [-TRACK, WHEEL_R, AXLE, -1, true],
    [TRACK, WHEEL_R, -AXLE, 1, false],
    [-TRACK, WHEEL_R, -AXLE, -1, false],
  ];

  return (
    <group>
      <ContactShadow width={2.6} length={5.2} />

      {wheelPos.map(([x, y, z, side, front], i) => (
        <group key={i} position={[x, y, z]} ref={(el) => (steerers.current[i] = front ? el : null)}>
          {/* caliper doesn't spin */}
          <mesh position={[-side * 0.02, 0.12, -0.12]} material={MAT.caliper}>
            <boxGeometry args={[0.08, 0.16, 0.12]} />
          </mesh>
          <group ref={(el) => (wheels.current[i] = el)}>
            <Wheel radius={WHEEL_R} width={0.27} side={side} spokes={10} />
          </group>
        </group>
      ))}

      <group ref={body}>
        <mesh geometry={geo.body} material={bodyPaint} castShadow />
        <mesh geometry={geo.glass} material={MAT.glass} castShadow />
        <mesh geometry={geo.roof} material={bodyPaint} />
        <mesh geometry={geo.sill} material={MAT.trim} />

        {/* front: grille, intakes, splitter */}
        <RoundedBox args={[1.05, 0.15, 0.08]} radius={0.03} position={[0, 0.46, L + B + 0.02]} material={MAT.trim} />
        <RoundedBox args={[0.34, 0.1, 0.06]} radius={0.03} position={[0.66, 0.4, L + B - 0.02]} material={MAT.trim} />
        <RoundedBox args={[0.34, 0.1, 0.06]} radius={0.03} position={[-0.66, 0.4, L + B - 0.02]} material={MAT.trim} />
        <mesh position={[0, 0.25, L + B - 0.06]} material={MAT.trim}>
          <boxGeometry args={[1.8, 0.04, 0.22]} />
        </mesh>

        {/* headlights: lens over an LED strip */}
        {[1, -1].map((side) => (
          <group key={side} position={[side * 0.64, 0.7, L + B - 0.12]} rotation={[0.32, side * 0.32, 0]}>
            <RoundedBox args={[0.46, 0.1, 0.12]} radius={0.04} material={MAT.trim} />
            <mesh position={[0, 0, 0.055]} material={head}>
              <boxGeometry args={[0.38, 0.025, 0.02]} />
            </mesh>
            <RoundedBox args={[0.46, 0.1, 0.06]} radius={0.03} position={[0, 0, 0.04]} material={MAT.lens} />
          </group>
        ))}

        {/* rear: full-width light bar, diffuser, exhausts, plate */}
        <mesh position={[0, 0.8, -L - B - 0.01]} material={tail}>
          <boxGeometry args={[1.62, 0.05, 0.04]} />
        </mesh>
        {[1, -1].map((side) => (
          <mesh key={side} position={[side * 0.74, 0.74, -L - B + 0.01]} material={tail}>
            <boxGeometry args={[0.22, 0.13, 0.05]} />
          </mesh>
        ))}
        <mesh position={[0, 0.3, -L - B + 0.04]} material={MAT.trim}>
          <boxGeometry args={[1.5, 0.12, 0.16]} />
        </mesh>
        {[0.42, -0.42].map((x) => (
          <mesh key={x} position={[x, 0.3, -L - B - 0.06]} rotation={[Math.PI / 2, 0, 0]} material={MAT.chrome}>
            <cylinderGeometry args={[0.055, 0.06, 0.16, 16, 1, true]} />
          </mesh>
        ))}
        <mesh position={[0, 0.52, -L - B - 0.012]} rotation={[0, Math.PI, 0]} material={plate}>
          <planeGeometry args={[0.52, 0.13]} />
        </mesh>

        {/* mirrors */}
        {[1, -1].map((side) => (
          <group key={side} position={[side * 1.04, 1.02, 0.62]}>
            <RoundedBox args={[0.18, 0.1, 0.13]} radius={0.04} material={bodyPaint} />
            <mesh position={[0, 0, -0.07]} material={MAT.chrome}>
              <boxGeometry args={[0.14, 0.07, 0.005]} />
            </mesh>
          </group>
        ))}

        {/* ducktail spoiler lip */}
        <mesh position={[0, 0.985 + B, -2.05]} rotation={[0.15, 0, 0]} material={MAT.trim}>
          <boxGeometry args={[1.5, 0.03, 0.22]} />
        </mesh>

        {/* night beams */}
        <group ref={lights} visible={false}>
          <HeadBeam position={[0, 0.7, L + B + 0.1]} />
        </group>
      </group>
    </group>
  );
}
