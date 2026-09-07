import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useCanvasTexture, type Draw } from '../lib/canvasTexture';
import { useQualityContext } from '../hooks/QualityContext';
import { journey } from '../state/journey';
import { damp } from '../animations/easing';
import { useIslandPresence } from '../scenes/IslandContext';

interface HoloPanelProps {
  draw: Draw;
  /** World size in metres. */
  width: number;
  height: number;
  position?: [number, number, number];
  rotation?: [number, number, number];
  opacity?: number;
  /** How strongly the panel drifts with the pointer. */
  parallax?: number;
  /** Vertical bob amplitude. */
  float?: number;
  phase?: number;
  additive?: boolean;
  deps?: unknown[];
}

const PX_PER_UNIT = 420;

/**
 * A flat holographic surface: a canvas-drawn texture on an additive plane.
 * Cheaper and sharper than rendering DOM into WebGL, and it disposes cleanly.
 */
export function HoloPanel({
  draw,
  width,
  height,
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  opacity = 1,
  parallax = 0.06,
  float = 0.035,
  phase = 0,
  additive = true,
  deps = [],
}: HoloPanelProps) {
  const quality = useQualityContext();
  const group = useRef<THREE.Group>(null);
  const material = useRef<THREE.MeshBasicMaterial>(null);
  const presence = useIslandPresence();
  const scale = Math.max(0.5, quality.textureScale);

  const texture = useCanvasTexture(
    Math.round(width * PX_PER_UNIT * scale),
    Math.round(height * PX_PER_UNIT * scale),
    draw,
    deps,
  );

  useFrame((state, delta) => {
    const g = group.current;
    if (!g) return;
    if (material.current) material.current.opacity = opacity * presence();
    const t = state.clock.elapsedTime + phase;
    const bob = Math.sin(t * 0.6) * float;
    g.position.y = damp(g.position.y, position[1] + bob, 4, delta);
    g.position.x = damp(g.position.x, position[0] + journey.pointer.x * parallax, 3, delta);
    g.rotation.y = damp(g.rotation.y, rotation[1] - journey.pointer.x * parallax * 0.5, 3, delta);
    g.rotation.x = damp(g.rotation.x, rotation[0] + journey.pointer.y * parallax * 0.25, 3, delta);
  });

  return (
    <group ref={group} position={position} rotation={rotation}>
      <mesh>
        <planeGeometry args={[width, height]} />
        <meshBasicMaterial
          ref={material}
          map={texture}
          transparent
          opacity={opacity}
          depthWrite={false}
          blending={additive ? THREE.AdditiveBlending : THREE.NormalBlending}
          toneMapped={false}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  );
}
