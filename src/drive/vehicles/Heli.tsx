import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { RoundedBox } from '@react-three/drei';
import * as THREE from 'three';
import { ContactShadow, HeadBeam, Limb, MAT, paint } from './parts';
import type { HeliSim } from './sims';
import { runtime } from '../state';

/** Light utility helicopter: four-blade main rotor, tail rotor, skids. */

const MAST_Y = 2.95;
const BLADE = 5.0;

export function HeliModel({ sim }: { sim: HeliSim }) {
  const rotor = useRef<THREE.Group>(null);
  const tail = useRef<THREE.Group>(null);
  const disc = useRef<THREE.Mesh>(null);
  const blades = useRef<THREE.Group>(null);
  const beam = useRef<THREE.Group>(null);
  const shadow = useRef<THREE.Group>(null);

  const mats = useMemo(() => {
    const body = paint('#f2a900', 0.35);
    const dark = paint('#1b1e24', 0.5);
    const blur = new THREE.MeshBasicMaterial({ color: '#15171b', transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide });
    const beacon = MAT.navRed.clone();
    return { body, dark, blur, beacon };
  }, []);

  useFrame((state) => {
    if (rotor.current) rotor.current.rotation.y = sim.rotor;
    if (tail.current) tail.current.rotation.x = sim.tailRotor;
    const fast = sim.spool > 0.6;
    if (blades.current) blades.current.visible = !fast || sim.spool < 0.95;
    mats.blur.opacity = Math.max(0, (sim.spool - 0.4) * 0.3);
    if (disc.current) disc.current.visible = sim.spool > 0.4;
    const t = state.clock.elapsedTime;
    mats.beacon.emissiveIntensity = Math.sin(t * 6) > 0.6 ? 6 : 0.3;
    if (beam.current) beam.current.visible = runtime.nightMix > 0.35;
    if (shadow.current) shadow.current.visible = sim.grounded;
  });

  return (
    <group>
      <group ref={shadow}>
        <ContactShadow width={4} length={6} />
      </group>

      {/* cabin pod */}
      <mesh position={[0, 1.5, 0.35]} scale={[1.02, 0.95, 1.6]} material={mats.body} castShadow>
        <sphereGeometry args={[1, 36, 24]} />
      </mesh>
      {/* bubble windscreen */}
      <mesh position={[0, 1.5, 0.35]} scale={[1.04, 0.97, 1.62]} material={MAT.glass}>
        <sphereGeometry args={[1, 36, 24, Math.PI * 0.18, Math.PI * 0.64, Math.PI * 0.12, Math.PI * 0.5]} />
      </mesh>
      {/* side windows */}
      {[1, -1].map((s) => (
        <mesh key={s} position={[s * 0.98, 1.72, -0.15]} rotation={[0, s * Math.PI / 2, 0]} scale={[1, 0.8, 1]} material={MAT.glass}>
          <circleGeometry args={[0.38, 24]} />
        </mesh>
      ))}
      {/* stripe */}
      <mesh position={[0, 1.18, 0.3]} scale={[1.035, 0.16, 1.62]} material={mats.dark}>
        <sphereGeometry args={[1, 36, 8, 0, Math.PI * 2, Math.PI * 0.42, Math.PI * 0.16]} />
      </mesh>

      {/* engine deck */}
      <RoundedBox args={[1.05, 0.5, 1.7]} radius={0.2} position={[0, 2.32, -0.45]} material={mats.body} castShadow />
      <RoundedBox args={[0.7, 0.2, 0.5]} radius={0.08} position={[0, 2.62, -0.95]} material={mats.dark} />

      {/* tail boom, fin, stabiliser */}
      <mesh position={[0, 2.0, -3.25]} rotation={[-Math.PI / 2, 0, 0]} material={mats.body} castShadow>
        <cylinderGeometry args={[0.11, 0.3, 4.6, 18]} />
      </mesh>
      <mesh position={[0, 2.0, -4.55]} material={mats.dark}>
        <boxGeometry args={[1.7, 0.05, 0.42]} />
      </mesh>
      <mesh position={[0, 2.45, -5.45]} rotation={[0.35, 0, 0]} material={mats.body} castShadow>
        <boxGeometry args={[0.07, 1.25, 0.62]} />
      </mesh>
      <mesh position={[0, 2.95, -5.55]} material={mats.beacon}>
        <sphereGeometry args={[0.06, 10, 8]} />
      </mesh>

      {/* tail rotor */}
      <group position={[0.14, 2.42, -5.5]}>
        <group ref={tail}>
          {[0, Math.PI / 2].map((a) => (
            <mesh key={a} rotation={[a, 0, 0]} material={MAT.trim}>
              <boxGeometry args={[0.03, 1.2, 0.11]} />
            </mesh>
          ))}
        </group>
      </group>

      {/* main rotor */}
      <mesh position={[0, MAST_Y - 0.2, -0.3]} material={MAT.metal}>
        <cylinderGeometry args={[0.08, 0.1, 0.45, 12]} />
      </mesh>
      <group position={[0, MAST_Y, -0.3]}>
        <group ref={rotor}>
          <mesh material={MAT.metal}>
            <cylinderGeometry args={[0.2, 0.2, 0.12, 12]} />
          </mesh>
          <group ref={blades}>
            {[0, 1, 2, 3].map((i) => (
              <group key={i} rotation={[0, (i / 4) * Math.PI * 2, 0]}>
                <mesh position={[0, 0, BLADE / 2 + 0.15]} rotation={[0, 0, 0.06]} material={MAT.trim} castShadow>
                  <boxGeometry args={[0.28, 0.035, BLADE]} />
                </mesh>
              </group>
            ))}
          </group>
        </group>
        <mesh ref={disc} rotation={[-Math.PI / 2, 0, 0]} material={mats.blur}>
          <ringGeometry args={[0.3, BLADE + 0.15, 48]} />
        </mesh>
      </group>

      {/* skids */}
      {[1, -1].map((s) => (
        <group key={s}>
          <Limb from={[s * 0.95, 0.06, -1.2]} to={[s * 0.95, 0.06, 1.3]} radius={0.055} material={MAT.metal} />
          <Limb from={[s * 0.95, 0.06, 1.3]} to={[s * 0.95, 0.3, 1.65]} radius={0.055} material={MAT.metal} />
          <Limb from={[s * 0.95, 0.06, 0.8]} to={[s * 0.55, 0.85, 0.75]} radius={0.045} material={MAT.metal} />
          <Limb from={[s * 0.95, 0.06, -0.7]} to={[s * 0.55, 0.85, -0.6]} radius={0.045} material={MAT.metal} />
        </group>
      ))}

      {/* searchlight */}
      <mesh position={[0, 0.72, 1.4]} material={MAT.headlight}>
        <sphereGeometry args={[0.1, 12, 8]} />
      </mesh>
      <group ref={beam} visible={false}>
        <HeadBeam position={[0, 0.7, 1.45]} distance={90} intensity={80} angle={0.45} />
      </group>
    </group>
  );
}
