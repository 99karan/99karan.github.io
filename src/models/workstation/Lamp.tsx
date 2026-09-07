import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useQualityContext } from '../../hooks/QualityContext';
import { journey } from '../../state/journey';
import { damp } from '../../animations/easing';
import { DESK } from './Desk';

/** Warm counterpoint to all the cold screen light — and the only shadow caster. */
export function Lamp() {
  const quality = useQualityContext();
  const head = useRef<THREE.Group>(null);
  const spot = useRef<THREE.SpotLight>(null);
  // A spotlight needs a target object that lives in the scene graph.
  const target = useMemo(() => new THREE.Object3D(), []);

  useFrame((state, delta) => {
    if (head.current) {
      head.current.rotation.y = damp(head.current.rotation.y, -0.5 - journey.pointer.x * 0.09, 2.2, delta);
    }
    if (spot.current) {
      const t = state.clock.elapsedTime;
      spot.current.intensity = 26 + Math.sin(t * 2.1) * 0.6;
    }
  });

  return (
    <group position={[-1.32, DESK.TOP_Y, -0.18]}>
      <mesh position={[0, 0.012, 0]} receiveShadow={quality.shadows}>
        <cylinderGeometry args={[0.115, 0.13, 0.024, quality.segments * 2]} />
        <meshStandardMaterial color="#161c25" roughness={0.3} metalness={0.92} envMapIntensity={1.2} />
      </mesh>

      <mesh position={[0, 0.3, 0]} rotation={[0, 0, 0.12]}>
        <cylinderGeometry args={[0.012, 0.014, 0.58, 8]} />
        <meshStandardMaterial color="#1b2129" roughness={0.28} metalness={0.95} />
      </mesh>

      <group ref={head} position={[0.075, 0.59, 0]}>
        <mesh rotation={[0, 0, -1.05]} position={[0.14, 0.02, 0]}>
          <cylinderGeometry args={[0.011, 0.011, 0.3, 8]} />
          <meshStandardMaterial color="#1b2129" roughness={0.28} metalness={0.95} />
        </mesh>
        <mesh position={[0.28, -0.03, 0]} rotation={[0, 0, -0.95]}>
          <coneGeometry args={[0.1, 0.16, quality.segments * 2, 1, true]} />
          <meshStandardMaterial
            color="#1b2129"
            roughness={0.35}
            metalness={0.9}
            side={THREE.DoubleSide}
            envMapIntensity={1.2}
          />
        </mesh>
        <mesh position={[0.3, -0.09, 0]}>
          <sphereGeometry args={[0.038, quality.segments, quality.segments]} />
          <meshBasicMaterial color="#ffcf9b" toneMapped={false} />
        </mesh>
      </group>

      <primitive object={target} position={[0.85, -0.05, 0.35]} />
      <spotLight
        ref={spot}
        position={[0.36, 0.5, 0]}
        target={target}
        angle={0.72}
        penumbra={0.85}
        intensity={26}
        distance={4.4}
        decay={2}
        color="#ffb46a"
        castShadow={quality.shadows}
        shadow-mapSize-width={quality.shadowSize}
        shadow-mapSize-height={quality.shadowSize}
        shadow-bias={-0.0012}
        shadow-normalBias={0.02}
      />
      <pointLight position={[0.3, 0.5, 0.05]} color="#ffb46a" intensity={1.4} distance={1.6} decay={2} />
    </group>
  );
}
