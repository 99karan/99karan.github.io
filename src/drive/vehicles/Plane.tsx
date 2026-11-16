import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { ContactShadow, Limb, MAT, paint } from './parts';
import type { PlaneSim } from './sims';
import { runtime } from '../state';

/**
 * Low-wing sport aircraft. Control surfaces, propeller and lights are all
 * driven from the flight model, so what you see is what the sim is doing.
 */

const FUSE_Y = 1.5;

function liveryTexture() {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 64;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#f4f5f7';
  ctx.fillRect(0, 0, 512, 64);
  // Lathe U wraps the circumference: 0.25 / 0.75 are the flanks.
  for (const u of [0.215, 0.785]) {
    ctx.fillStyle = '#0f7f71';
    ctx.fillRect(u * 512 - 14, 0, 28, 64);
    ctx.fillStyle = '#14161a';
    ctx.fillRect(u * 512 + (u < 0.5 ? 16 : -22), 0, 6, 64);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function tailTexture() {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 128;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#0f7f71';
  ctx.fillRect(0, 0, 256, 128);
  ctx.fillStyle = '#f4f5f7';
  ctx.font = '700 38px "Space Grotesk", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('KP-99', 128, 66);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function planform(points: [number, number][], thickness: number, bevel: number) {
  const s = new THREE.Shape();
  points.forEach(([x, y], i) => (i === 0 ? s.moveTo(x, y) : s.lineTo(x, y)));
  const g = new THREE.ExtrudeGeometry(s, {
    depth: thickness,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 3,
  });
  g.translate(0, 0, -thickness / 2);
  return g;
}

function usePlaneGeometry() {
  return useMemo(() => {
    const prof: [number, number][] = [
      [0.001, -4.2],
      [0.14, -4.05],
      [0.28, -3.2],
      [0.46, -1.8],
      [0.6, -0.6],
      [0.68, 0.4],
      [0.7, 1.4],
      [0.66, 2.3],
      [0.56, 3.0],
      [0.44, 3.32],
      [0.001, 3.34],
    ];
    const fuselage = new THREE.LatheGeometry(
      prof.map(([r, y]) => new THREE.Vector2(r, y)),
      40,
    );
    fuselage.rotateX(Math.PI / 2);

    // Wing: tapered planform, lying flat, leading edge forward.
    const wing = planform(
      [
        [0, 0.95],
        [5.0, 0.55],
        [5.25, 0.3],
        [5.1, -0.38],
        [0, -0.75],
        [-5.1, -0.38],
        [-5.25, 0.3],
        [-5.0, 0.55],
      ],
      0.1,
      0.05,
    );
    wing.rotateX(Math.PI / 2);

    const stab = planform(
      [
        [0, 0.45],
        [1.7, 0.2],
        [1.75, -0.12],
        [0, -0.2],
        [-1.75, -0.12],
        [-1.7, 0.2],
      ],
      0.06,
      0.03,
    );
    stab.rotateX(Math.PI / 2);

    // Fin: profile in (z, y), extruded across the aircraft.
    const finShape = new THREE.Shape();
    finShape.moveTo(-3.0, 0);
    finShape.lineTo(-3.85, 1.35);
    finShape.lineTo(-4.3, 1.38);
    finShape.lineTo(-4.25, 0);
    finShape.lineTo(-3.0, 0);
    const fin = new THREE.ExtrudeGeometry(finShape, {
      depth: 0.04,
      bevelEnabled: true,
      bevelThickness: 0.03,
      bevelSize: 0.03,
      bevelSegments: 2,
    });
    fin.translate(0, 0, -0.02);
    fin.rotateY(-Math.PI / 2);

    const spinner = new THREE.ConeGeometry(0.34, 0.55, 24);
    spinner.rotateX(Math.PI / 2);

    return { fuselage, wing, stab, fin, spinner };
  }, []);
}

export function PlaneModel({ sim }: { sim: PlaneSim }) {
  const geo = usePlaneGeometry();
  const prop = useRef<THREE.Group>(null);
  const blur = useRef<THREE.Mesh>(null);
  const blades = useRef<THREE.Group>(null);
  const aileronL = useRef<THREE.Group>(null);
  const aileronR = useRef<THREE.Group>(null);
  const elevator = useRef<THREE.Group>(null);
  const rudder = useRef<THREE.Group>(null);
  const shadow = useRef<THREE.Group>(null);

  const mats = useMemo(() => {
    const body = paint('#f4f5f7', 0.25);
    body.map = liveryTexture();
    const tail = paint('#0f7f71', 0.4);
    const tailDecal = new THREE.MeshStandardMaterial({ map: tailTexture(), roughness: 0.4, polygonOffset: true, polygonOffsetFactor: -2 });
    const white = paint('#f4f5f7', 0.25);
    const blurMat = new THREE.MeshBasicMaterial({ color: '#202428', transparent: true, opacity: 0.15, depthWrite: false, side: THREE.DoubleSide });
    const strobe = MAT.strobe.clone();
    return { body, tail, tailDecal, white, blurMat, strobe };
  }, []);

  useFrame((state) => {
    if (prop.current) prop.current.rotation.z = sim.prop;
    const fast = sim.throttle > 0.3;
    if (blades.current) blades.current.visible = !fast;
    if (blur.current) {
      blur.current.visible = sim.throttle > 0.05;
      mats.blurMat.opacity = 0.08 + sim.throttle * 0.18;
    }
    if (aileronL.current) aileronL.current.rotation.x = -sim.aileron * 0.35;
    if (aileronR.current) aileronR.current.rotation.x = sim.aileron * 0.35;
    if (elevator.current) elevator.current.rotation.x = sim.elevator * 0.4;
    if (rudder.current) rudder.current.rotation.y = sim.rudder * 0.4;
    const t = state.clock.elapsedTime;
    mats.strobe.emissiveIntensity = t % 1.2 < 0.06 ? 8 : 0;
    // Shadow blob only near the ground.
    if (shadow.current) shadow.current.visible = sim.grounded;
    void runtime;
  });

  return (
    <group>
      <group ref={shadow}>
        <ContactShadow width={9} length={8} opacity={0.5} />
      </group>

      <group position={[0, FUSE_Y, 0]}>
        <mesh geometry={geo.fuselage} material={mats.body} scale={[0.92, 1, 1]} castShadow />

        {/* canopy */}
        <mesh position={[0, 0.5, 0.45]} scale={[0.5, 0.42, 1.3]} material={MAT.glass}>
          <sphereGeometry args={[1, 28, 18, 0, Math.PI * 2, 0, Math.PI / 2]} />
        </mesh>
        <mesh position={[0, 0.5, 0.45]} scale={[0.505, 0.425, 1.31]} rotation={[0, 0, 0]} material={MAT.trim}>
          <torusGeometry args={[1, 0.02, 6, 30, Math.PI]} />
        </mesh>

        {/* wing */}
        <group position={[0, -0.42, 0.65]}>
          <mesh geometry={geo.wing} material={mats.white} castShadow />
          <group ref={aileronL} position={[3.8, 0, -0.45]}>
            <mesh position={[0, 0, -0.14]} material={mats.white}>
              <boxGeometry args={[2.2, 0.06, 0.28]} />
            </mesh>
          </group>
          <group ref={aileronR} position={[-3.8, 0, -0.45]}>
            <mesh position={[0, 0, -0.14]} material={mats.white}>
              <boxGeometry args={[2.2, 0.06, 0.28]} />
            </mesh>
          </group>
          {/* wingtips + nav lights: red to port (left), green to starboard */}
          <mesh position={[5.18, 0.02, 0.1]} material={mats.tail}>
            <boxGeometry args={[0.16, 0.12, 0.85]} />
          </mesh>
          <mesh position={[-5.18, 0.02, 0.1]} material={mats.tail}>
            <boxGeometry args={[0.16, 0.12, 0.85]} />
          </mesh>
          <mesh position={[5.28, 0.03, 0.35]} material={MAT.navRed}>
            <sphereGeometry args={[0.06, 10, 8]} />
          </mesh>
          <mesh position={[-5.28, 0.03, 0.35]} material={MAT.navGreen}>
            <sphereGeometry args={[0.06, 10, 8]} />
          </mesh>
        </group>

        {/* tail */}
        <group position={[0, 0.08, -3.55]}>
          <mesh geometry={geo.stab} material={mats.white} castShadow />
          <group ref={elevator} position={[0, 0, -0.18]}>
            <mesh position={[0, 0, -0.13]} material={mats.white}>
              <boxGeometry args={[3.3, 0.05, 0.26]} />
            </mesh>
          </group>
        </group>
        <group position={[0, 0.15, 0]}>
          <mesh geometry={geo.fin} material={mats.tail} castShadow />
          <mesh position={[0.07, 0.7, -3.85]} rotation={[0, Math.PI / 2, 0]} material={mats.tailDecal}>
            <planeGeometry args={[0.75, 0.38]} />
          </mesh>
          <mesh position={[-0.07, 0.7, -3.85]} rotation={[0, -Math.PI / 2, 0]} material={mats.tailDecal}>
            <planeGeometry args={[0.75, 0.38]} />
          </mesh>
          <group ref={rudder} position={[0, 0, -4.27]}>
            <mesh position={[0, 0.68, -0.14]} material={mats.tail}>
              <boxGeometry args={[0.06, 1.3, 0.28]} />
            </mesh>
          </group>
          <mesh position={[0, 1.42, -4.15]} material={mats.strobe}>
            <sphereGeometry args={[0.06, 10, 8]} />
          </mesh>
        </group>

        {/* propeller */}
        <group position={[0, 0, 3.42]}>
          <mesh geometry={geo.spinner} position={[0, 0, 0.22]} material={MAT.chrome} />
          <group ref={prop}>
            <group ref={blades}>
              {[0, Math.PI].map((a) => (
                <mesh key={a} rotation={[0, 0.25, a]} position={[0, 0, 0.05]} material={MAT.trim}>
                  <boxGeometry args={[0.16, 2.0, 0.03]} />
                </mesh>
              ))}
            </group>
          </group>
          <mesh ref={blur} position={[0, 0, 0.06]} material={mats.blurMat}>
            <circleGeometry args={[1.0, 40]} />
          </mesh>
        </group>

        {/* exhaust + antenna */}
        <Limb from={[0.42, -0.42, 2.4]} to={[0.5, -0.6, 2.1]} radius={0.04} material={MAT.metal} />
        <Limb from={[0, 0.6, -1.2]} to={[0, 0.95, -1.5]} radius={0.012} material={MAT.trim} />
      </group>

      {/* landing gear */}
      {[1, -1].map((s) => (
        <group key={s}>
          <Limb from={[s * 0.45, 1.0, 0.45]} to={[s * 1.3, 0.28, 0.35]} radius={0.05} material={MAT.metal} />
          <mesh position={[s * 1.3, 0.26, 0.33]} scale={[0.17, 0.27, 0.55]} material={mats.white} castShadow>
            <sphereGeometry args={[1, 16, 12]} />
          </mesh>
          <mesh position={[s * 1.3, 0.24, 0.33]} rotation={[0, 0, Math.PI / 2]} material={MAT.rubber}>
            <cylinderGeometry args={[0.24, 0.24, 0.14, 18]} />
          </mesh>
        </group>
      ))}
      <Limb from={[0, 1.0, 2.5]} to={[0, 0.22, 2.55]} radius={0.04} material={MAT.metal} />
      <mesh position={[0, 0.2, 2.55]} rotation={[0, 0, Math.PI / 2]} material={MAT.rubber}>
        <cylinderGeometry args={[0.2, 0.2, 0.12, 16]} />
      </mesh>
    </group>
  );
}
