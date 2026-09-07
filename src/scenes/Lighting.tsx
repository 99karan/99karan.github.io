import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Environment, Lightformer } from '@react-three/drei';
import * as THREE from 'three';
import { journey, LAST_SECTION } from '../state/journey';
import { CAMERA_KEYS, SECTION_KEYS } from './layout';
import { clamp, damp } from '../animations/easing';
import type { Quality } from '../hooks/useQuality';

/** One travelling accent light beats six static ones: same look, a third of the shader cost. */
const SECTION_LIGHT: Record<string, { color: string; intensity: number }> = {
  hero: { color: '#66e0c0', intensity: 26 },
  about: { color: '#8ab6ff', intensity: 22 },
  skills: { color: '#66e0c0', intensity: 30 },
  projects: { color: '#8ab6ff', intensity: 26 },
  experience: { color: '#ffb46a', intensity: 24 },
  contact: { color: '#66e0c0', intensity: 30 },
};

export function Lighting({ quality }: { quality: Quality }) {
  const accent = useRef<THREE.PointLight>(null);
  const colorA = useMemo(() => new THREE.Color(), []);
  const colorB = useMemo(() => new THREE.Color(), []);
  const anchor = useMemo(() => new THREE.Vector3(), []);

  useFrame((_, delta) => {
    if (!accent.current) return;
    const dt = Math.min(delta, 0.1);
    const f = clamp(journey.flow, 0, LAST_SECTION);
    const i = Math.min(Math.floor(f), LAST_SECTION - 1);
    const mix = f - i;

    const a = SECTION_LIGHT[SECTION_KEYS[i]];
    const b = SECTION_LIGHT[SECTION_KEYS[i + 1]];
    colorA.set(a.color);
    colorB.set(b.color);
    accent.current.color.copy(colorA.lerp(colorB, mix));
    accent.current.intensity = damp(
      accent.current.intensity,
      THREE.MathUtils.lerp(a.intensity, b.intensity, mix),
      4,
      dt,
    );

    const ka = CAMERA_KEYS[SECTION_KEYS[i]].target;
    const kb = CAMERA_KEYS[SECTION_KEYS[i + 1]].target;
    anchor.set(
      THREE.MathUtils.lerp(ka[0], kb[0], mix),
      THREE.MathUtils.lerp(ka[1], kb[1], mix) + 3.1,
      THREE.MathUtils.lerp(ka[2], kb[2], mix) + 2.4,
    );
    accent.current.position.lerp(anchor, 1 - Math.exp(-3 * dt));
  });

  return (
    <>
      <ambientLight intensity={0.16} color="#7f8ea8" />
      <hemisphereLight args={['#20304a', '#04060a', 0.5]} />

      <directionalLight
        position={[6, 12, 6]}
        intensity={0.85}
        color="#cfe0ff"
        castShadow={quality.shadows}
        shadow-mapSize-width={quality.shadowSize}
        shadow-mapSize-height={quality.shadowSize}
        shadow-camera-near={1}
        shadow-camera-far={24}
        shadow-camera-left={-6}
        shadow-camera-right={6}
        shadow-camera-top={6}
        shadow-camera-bottom={-6}
        shadow-bias={-0.0008}
        shadow-normalBias={0.02}
      />

      <pointLight ref={accent} distance={26} decay={2} intensity={24} color="#66e0c0" />

      {/* Studio reflections without a network fetch — the lightformers are baked
          into a small cubemap once at mount. */}
      <Environment resolution={quality.tier === 'low' ? 64 : 128} frames={1}>
        <color attach="background" args={['#05070b']} />
        <Lightformer intensity={1.1} color="#8ab6ff" position={[-6, 4, -2]} scale={[9, 9, 1]} />
        <Lightformer intensity={0.75} color="#66e0c0" position={[6, 2, 2]} scale={[7, 7, 1]} />
        <Lightformer intensity={0.5} color="#ffb46a" position={[0, -4, 3]} scale={[10, 3, 1]} />
        <Lightformer
          intensity={1.5}
          color="#ffffff"
          position={[0, 8, 0]}
          rotation={[Math.PI / 2, 0, 0]}
          scale={[12, 4, 1]}
        />
      </Environment>
    </>
  );
}
