import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { RoundedBox } from '@react-three/drei';
import * as THREE from 'three';
import { useCanvasTexture } from '../../lib/canvasTexture';
import { drawMonitor } from '../../lib/screens';
import { useQualityContext } from '../../hooks/QualityContext';
import { profile } from '../../data/portfolio';
import { DESK } from './Desk';

const SCREEN_W = 2.08;
const SCREEN_H = 1.3;
const CENTER_Y = 1.6;
const Z = -0.32;

export function Monitor() {
  const quality = useQualityContext();
  const glow = useRef<THREE.PointLight>(null);

  const texture = useCanvasTexture(
    Math.round(2304 * quality.textureScale),
    Math.round(1440 * quality.textureScale),
    drawMonitor(profile.name, profile.role, profile.tagline),
  );

  useFrame((state) => {
    if (!glow.current) return;
    const t = state.clock.elapsedTime;
    glow.current.intensity = 3.1 + Math.sin(t * 1.7) * 0.12 + Math.sin(t * 5.3) * 0.05;
  });

  return (
    <group position={[0, 0, Z]}>
      {/* stand */}
      <mesh position={[0, DESK.TOP_Y + 0.01, 0.02]} receiveShadow={quality.shadows}>
        <cylinderGeometry args={[0.26, 0.3, 0.018, quality.segments * 3]} />
        <meshStandardMaterial color="#151b23" roughness={0.3} metalness={0.92} envMapIntensity={1.2} />
      </mesh>
      <mesh position={[0, DESK.TOP_Y + 0.09, 0]} castShadow={quality.shadows}>
        <boxGeometry args={[0.085, 0.18, 0.055]} />
        <meshStandardMaterial color="#171e27" roughness={0.28} metalness={0.95} />
      </mesh>

      {/* chassis */}
      <RoundedBox
        args={[SCREEN_W + 0.08, SCREEN_H + 0.09, 0.045]}
        radius={0.014}
        smoothness={3}
        position={[0, CENTER_Y, -0.02]}
        castShadow={quality.shadows}
      >
        <meshStandardMaterial color="#0a0e14" roughness={0.42} metalness={0.7} envMapIntensity={0.9} />
      </RoundedBox>

      {/* screen */}
      <mesh position={[0, CENTER_Y, 0.004]}>
        <planeGeometry args={[SCREEN_W, SCREEN_H]} />
        <meshBasicMaterial map={texture} toneMapped={false} />
      </mesh>

      {/* screen glass sheen */}
      <mesh position={[0, CENTER_Y, 0.006]}>
        <planeGeometry args={[SCREEN_W, SCREEN_H]} />
        <meshPhysicalMaterial
          transparent
          opacity={0.05}
          roughness={0.12}
          metalness={0}
          color="#9fd8ff"
          depthWrite={false}
        />
      </mesh>

      {/* light spilling from the panel */}
      <pointLight ref={glow} position={[0, CENTER_Y, 0.55]} color="#79d9ff" intensity={3.1} distance={4.2} decay={2} />
      <mesh position={[0, CENTER_Y - SCREEN_H / 2 - 0.05, 0.01]}>
        <planeGeometry args={[SCREEN_W * 0.9, 0.02]} />
        <meshBasicMaterial color="#66e0c0" transparent opacity={0.35} toneMapped={false} />
      </mesh>
    </group>
  );
}

export const MONITOR = { SCREEN_W, SCREEN_H, CENTER_Y, Z };
