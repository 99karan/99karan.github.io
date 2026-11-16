import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { RoundedBox } from '@react-three/drei';
import * as THREE from 'three';
import { ContactShadow, HeadBeam, Limb, MAT, paint } from './parts';
import type { GroundSim } from './sims';
import { BIKE_PARAMS } from './sims';
import { runtime } from '../state';

/**
 * Supersport motorcycle with rider. The front end is a real steering
 * assembly: fork, wheel and bars rotate about the raked steering axis.
 */

const R = BIKE_PARAMS.wheelRadius;
const AXLE = BIKE_PARAMS.wheelBase / 2;
const HEAD: [number, number, number] = [0, 1.0, 0.47];
const RAKE = -0.36;
const FORK = 0.73;

function BikeWheel({ front }: { front: boolean }) {
  const tyreW = front ? 0.12 : 0.17;
  return (
    <group>
      <mesh rotation={[0, Math.PI / 2, 0]} material={MAT.rubber} castShadow>
        <torusGeometry args={[R - tyreW * 0.45, tyreW * 0.5, 12, 40]} />
      </mesh>
      {/* 3-spoke cast wheel */}
      {[0, 1, 2].map((i) => (
        <mesh key={i} rotation={[(i / 3) * Math.PI * 2, 0, 0]} position={[0, 0, 0]} material={MAT.darkRim}>
          <boxGeometry args={[0.04, R * 1.1, 0.045]} />
        </mesh>
      ))}
      <mesh rotation={[0, Math.PI / 2, 0]} material={MAT.darkRim}>
        <torusGeometry args={[R - tyreW * 0.95, 0.018, 6, 36]} />
      </mesh>
      <mesh rotation={[0, 0, Math.PI / 2]} material={MAT.brakeDisc}>
        <cylinderGeometry args={[R * 0.62, R * 0.62, 0.012, 28]} />
      </mesh>
      <mesh rotation={[0, 0, Math.PI / 2]} material={MAT.chrome}>
        <cylinderGeometry args={[0.04, 0.04, 0.2, 10]} />
      </mesh>
    </group>
  );
}

export function BikeModel({ sim }: { sim: GroundSim }) {
  const lean = useRef<THREE.Group>(null);
  const wheelie = useRef<THREE.Group>(null);
  const steer = useRef<THREE.Group>(null);
  const rear = useRef<THREE.Group>(null);
  const front = useRef<THREE.Group>(null);
  const beam = useRef<THREE.Group>(null);

  const body = useMemo(() => paint('#e8eaee', 0.35), []);
  const accent = useMemo(() => paint('#0f7f71', 0.5), []);
  const tail = useMemo(() => MAT.tail.clone(), []);

  useFrame(() => {
    if (lean.current) lean.current.rotation.z = sim.lean;
    if (wheelie.current) wheelie.current.rotation.x = -sim.wheelie + sim.bodyPitch * 0.5;
    if (steer.current) steer.current.rotation.y = -sim.steer * 0.8;
    if (rear.current) rear.current.rotation.x = sim.wheelSpin;
    if (front.current) front.current.rotation.x = sim.wheelSpin;
    tail.emissiveIntensity = sim.braking ? 4.5 : 1 + runtime.nightMix;
    if (beam.current) beam.current.visible = runtime.nightMix > 0.35;
  });

  return (
    <group>
      <ContactShadow width={1.2} length={2.6} />
      <group ref={lean}>
        {/* pivot about the rear contact patch for wheelies */}
        <group position={[0, 0, -AXLE]}>
          <group ref={wheelie}>
            <group position={[0, 0, AXLE]}>
              {/* rear wheel + swingarm */}
              <group position={[0, R, -AXLE]}>
                <group ref={rear}>
                  <BikeWheel front={false} />
                </group>
              </group>
              <Limb from={[0.11, 0.56, -0.2]} to={[0.11, R, -AXLE]} radius={0.035} material={MAT.metal} />
              <Limb from={[-0.11, 0.56, -0.2]} to={[-0.11, R, -AXLE]} radius={0.035} material={MAT.metal} />

              {/* frame spars */}
              <Limb from={[0.15, 0.98, 0.42]} to={[0.15, 0.58, -0.2]} radius={0.045} material={MAT.metal} />
              <Limb from={[-0.15, 0.98, 0.42]} to={[-0.15, 0.58, -0.2]} radius={0.045} material={MAT.metal} />

              {/* engine + belly pan */}
              <RoundedBox args={[0.36, 0.34, 0.5]} radius={0.06} position={[0, 0.55, 0.06]} material={MAT.trim} />
              <mesh position={[0, 0.56, 0.06]} rotation={[0, 0, Math.PI / 2]} material={MAT.metal}>
                <cylinderGeometry args={[0.13, 0.13, 0.42, 16]} />
              </mesh>
              <RoundedBox args={[0.4, 0.14, 0.6]} radius={0.05} position={[0, 0.36, 0.12]} rotation={[-0.15, 0, 0]} material={accent} />

              {/* tank, seat, tail */}
              <RoundedBox args={[0.42, 0.24, 0.56]} radius={0.1} position={[0, 1.0, 0.12]} rotation={[0.16, 0, 0]} material={body} castShadow />
              <RoundedBox args={[0.12, 0.25, 0.5]} radius={0.04} position={[0, 1.01, 0.13]} rotation={[0.16, 0, 0]} material={accent} />
              <RoundedBox args={[0.3, 0.08, 0.46]} radius={0.04} position={[0, 0.95, -0.36]} material={MAT.seat} />
              <RoundedBox args={[0.26, 0.15, 0.5]} radius={0.06} position={[0, 1.0, -0.76]} rotation={[-0.32, 0, 0]} material={body} castShadow />
              <mesh position={[0, 1.07, -1.01]} material={tail}>
                <boxGeometry args={[0.16, 0.04, 0.03]} />
              </mesh>

              {/* side fairings */}
              {[1, -1].map((side) => (
                <RoundedBox
                  key={side}
                  args={[0.05, 0.42, 0.62]}
                  radius={0.02}
                  position={[side * 0.22, 0.74, 0.32]}
                  rotation={[0.25, side * 0.12, 0]}
                  material={side > 0 ? body : body}
                  castShadow
                />
              ))}

              {/* nose fairing, headlight, screen */}
              <RoundedBox args={[0.42, 0.34, 0.36]} radius={0.12} position={[0, 1.04, 0.6]} rotation={[0.55, 0, 0]} material={body} castShadow />
              {[0.09, -0.09].map((x) => (
                <mesh key={x} position={[x, 1.0, 0.79]} rotation={[0.55, 0, 0]} material={MAT.headlight}>
                  <boxGeometry args={[0.11, 0.05, 0.02]} />
                </mesh>
              ))}
              <mesh position={[0, 1.24, 0.58]} rotation={[-0.75, 0, 0]} material={MAT.clearGlass}>
                <planeGeometry args={[0.32, 0.26]} />
              </mesh>
              <group ref={beam} visible={false}>
                <HeadBeam position={[0, 1.0, 0.85]} intensity={45} />
              </group>

              {/* exhaust */}
              <Limb from={[0.14, 0.4, 0.15]} to={[0.18, 0.62, -0.6]} radius={0.035} material={MAT.chrome} />
              <mesh position={[0.2, 0.66, -0.72]} rotation={[Math.PI / 2 + 0.3, 0, 0]} material={MAT.metal}>
                <cylinderGeometry args={[0.07, 0.06, 0.32, 14]} />
              </mesh>

              {/* steering assembly about the raked axis */}
              <group position={HEAD} rotation={[RAKE, 0, 0]}>
                <group ref={steer}>
                  {[0.09, -0.09].map((x) => (
                    <Limb key={x} from={[x, 0.08, 0]} to={[x, -FORK + 0.02, 0]} radius={0.028} material={MAT.chrome} />
                  ))}
                  <mesh position={[0, 0.06, 0]} material={MAT.trim}>
                    <boxGeometry args={[0.28, 0.05, 0.1]} />
                  </mesh>
                  {[1, -1].map((side) => (
                    <Limb key={side} from={[side * 0.08, 0.1, -0.02]} to={[side * 0.33, 0.06, -0.1]} radius={0.017} material={MAT.trim} />
                  ))}
                  <group position={[0, -FORK, 0]} rotation={[-RAKE, 0, 0]}>
                    <group ref={front}>
                      <BikeWheel front />
                    </group>
                    <mesh position={[0, R + 0.06, 0.02]} material={body}>
                      <boxGeometry args={[0.16, 0.03, 0.42]} />
                    </mesh>
                  </group>
                </group>
              </group>

              <Rider />
            </group>
          </group>
        </group>
      </group>
    </group>
  );
}

function Rider() {
  return (
    <group>
      {/* torso, tucked */}
      <Limb from={[0, 1.07, -0.3]} to={[0, 1.36, 0.02]} radius={0.16} material={MAT.suit} />
      <Limb from={[0, 1.2, -0.17]} to={[0, 1.33, -0.02]} radius={0.165} material={MAT.suitAccent} />
      {/* arms */}
      {[1, -1].map((s) => (
        <group key={s}>
          <Limb from={[s * 0.2, 1.36, 0.04]} to={[s * 0.27, 1.19, 0.2]} radius={0.055} material={MAT.suit} />
          <Limb from={[s * 0.27, 1.19, 0.2]} to={[s * 0.31, 1.1, 0.4]} radius={0.048} material={MAT.suit} />
          {/* legs */}
          <Limb from={[s * 0.13, 1.0, -0.28]} to={[s * 0.24, 0.94, 0.1]} radius={0.075} material={MAT.suit} />
          <Limb from={[s * 0.24, 0.94, 0.1]} to={[s * 0.18, 0.5, -0.12]} radius={0.06} material={MAT.suit} />
          <mesh position={[s * 0.18, 0.47, -0.08]} material={MAT.trim}>
            <boxGeometry args={[0.09, 0.08, 0.24]} />
          </mesh>
        </group>
      ))}
      {/* helmet + visor */}
      <mesh position={[0, 1.55, 0.14]} scale={[1, 0.95, 1.08]} material={MAT.suitAccent} castShadow>
        <sphereGeometry args={[0.16, 24, 18]} />
      </mesh>
      <mesh position={[0, 1.555, 0.2]} scale={[0.92, 0.55, 0.9]} material={MAT.visor}>
        <sphereGeometry args={[0.16, 24, 12, Math.PI * 0.15, Math.PI * 0.7, Math.PI * 0.3, Math.PI * 0.45]} />
      </mesh>
    </group>
  );
}
