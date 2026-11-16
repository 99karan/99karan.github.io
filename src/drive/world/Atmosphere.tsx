import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Environment, Lightformer } from '@react-three/drei';
import * as THREE from 'three';
import { runtime, store } from '../state';
import { atmosphere } from './Landscape';

const DAY = {
  sky: new THREE.Color('#4f93d6'),
  horizon: new THREE.Color('#cde3f1'),
  sun: new THREE.Color('#fff0d4'),
  fog: new THREE.Color('#c4dbea'),
  hemiSky: new THREE.Color('#cfe6ff'),
  hemiGround: new THREE.Color('#6b7b4a'),
};
const NIGHT = {
  sky: new THREE.Color('#050b1c'),
  horizon: new THREE.Color('#16223f'),
  sun: new THREE.Color('#9db4ff'),
  fog: new THREE.Color('#0e1730'),
  hemiSky: new THREE.Color('#33466e'),
  hemiGround: new THREE.Color('#141a22'),
};

const SUN_DAY = new THREE.Vector3(0.45, 0.62, 0.35).normalize();
const MOON = new THREE.Vector3(-0.35, 0.55, -0.4).normalize();

/**
 * Sun, sky, fog and the day/night blend. The shadow camera rides along with
 * the player so a tight shadow frustum stays sharp anywhere on the island.
 */
export function Atmosphere({ shadows, shadowSize }: { shadows: boolean; shadowSize: number }) {
  const sun = useRef<THREE.DirectionalLight>(null);
  const hemi = useRef<THREE.HemisphereLight>(null);
  const { scene, gl } = useThree();
  const target = useMemo(() => new THREE.Object3D(), []);
  const fog = useMemo(() => new THREE.Fog(DAY.fog.clone(), 220, 1100), []);

  useEffect(() => {
    scene.fog = fog;
    scene.add(target);
    return () => {
      scene.fog = null;
      scene.remove(target);
    };
  }, [scene, fog, target]);

  useFrame((_, dt) => {
    const want = store.get().night ? 1 : 0;
    runtime.nightMix += (want - runtime.nightMix) * (1 - Math.exp(-1.6 * dt));
    const k = runtime.nightMix;

    atmosphere.sky.copy(DAY.sky).lerp(NIGHT.sky, k);
    atmosphere.horizon.copy(DAY.horizon).lerp(NIGHT.horizon, k);
    atmosphere.sunColor.copy(DAY.sun).lerp(NIGHT.sun, k);
    atmosphere.sunDir.copy(SUN_DAY).lerp(MOON, k).normalize();
    fog.color.copy(DAY.fog).lerp(NIGHT.fog, k);
    fog.far = THREE.MathUtils.lerp(1100, 700, k);

    // Higher up you see further.
    const alt = Math.max(0, runtime.position.y - 20);
    fog.near = 220 + alt * 1.5;
    fog.far += alt * 2;

    scene.environmentIntensity = THREE.MathUtils.lerp(0.7, 0.12, k);
    gl.toneMappingExposure = THREE.MathUtils.lerp(1.0, 1.3, k);

    const p = runtime.position;
    if (sun.current) {
      sun.current.intensity = THREE.MathUtils.lerp(2.3, 0.3, k);
      sun.current.color.copy(atmosphere.sunColor);
      // Snap to texels so shadows don't shimmer while driving.
      const snap = 0.5;
      const cx = Math.round(p.x / snap) * snap;
      const cz = Math.round(p.z / snap) * snap;
      target.position.set(cx, p.y, cz);
      sun.current.position.set(cx, p.y, cz).addScaledVector(atmosphere.sunDir, 160);
      sun.current.target = target;
    }
    if (hemi.current) {
      hemi.current.color.copy(DAY.hemiSky).lerp(NIGHT.hemiSky, k);
      hemi.current.groundColor.copy(DAY.hemiGround).lerp(NIGHT.hemiGround, k);
      hemi.current.intensity = THREE.MathUtils.lerp(0.55, 0.35, k);
    }
  });

  return (
    <>
      <hemisphereLight ref={hemi} args={['#cfe6ff', '#6b7b4a', 0.55]} />
      <directionalLight
        ref={sun}
        castShadow={shadows}
        intensity={2.3}
        shadow-mapSize={[shadowSize, shadowSize]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.04}
        shadow-camera-left={-70}
        shadow-camera-right={70}
        shadow-camera-top={70}
        shadow-camera-bottom={-70}
        shadow-camera-near={10}
        shadow-camera-far={360}
      />
      {/* Reflections for paint and glass: a soft studio-sky rendered once. */}
      <Environment resolution={128} frames={1}>
        <mesh scale={100}>
          <sphereGeometry args={[1, 32, 16]} />
          <meshBasicMaterial color="#8fb6d8" side={THREE.BackSide} />
        </mesh>
        <Lightformer form="rect" intensity={1.1} color="#ffffff" position={[0, 40, 0]} rotation-x={Math.PI / 2} scale={[80, 80, 1]} />
        <Lightformer form="rect" intensity={1.2} color="#d6e8ff" position={[60, 10, 0]} rotation-y={-Math.PI / 2} scale={[80, 14, 1]} />
        <Lightformer form="rect" intensity={1.2} color="#ffe8cc" position={[-60, 10, 0]} rotation-y={Math.PI / 2} scale={[80, 14, 1]} />
        <Lightformer form="circle" intensity={8} color="#fff4e0" position={[45, 60, 35]} scale={14} />
        <mesh position={[0, -40, 0]} rotation-x={-Math.PI / 2} scale={200}>
          <planeGeometry />
          <meshBasicMaterial color="#5b6b48" />
        </mesh>
      </Environment>
    </>
  );
}
