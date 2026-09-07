import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { ThreeEvent } from '@react-three/fiber';
import { damp } from '../animations/easing';
import { useIslandPresence } from '../scenes/IslandContext';

/** Pointer-over state plus a managed cursor, safe on touch devices. */
export function useHover(enabled = true) {
  const [hovered, setHovered] = useState(false);

  useEffect(() => {
    if (!hovered || !enabled) return;
    document.body.style.cursor = 'pointer';
    return () => {
      document.body.style.cursor = '';
    };
  }, [hovered, enabled]);

  const onPointerOver = useCallback(
    (event: ThreeEvent<PointerEvent>) => {
      if (!enabled) return;
      event.stopPropagation();
      setHovered(true);
    },
    [enabled],
  );

  const onPointerOut = useCallback((event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation();
    setHovered(false);
  }, []);

  return { hovered, bind: { onPointerOver, onPointerOut } };
}

/** Damps a scalar towards a target every frame without re-rendering React. */
export function useDamped(target: number, lambda = 6, initial = target) {
  const ref = useRef(initial);
  const goal = useRef(target);
  goal.current = target;
  useFrame((_, delta) => {
    ref.current = damp(ref.current, goal.current, lambda, delta);
  });
  return ref;
}

/** Unlit, tone-mapping-free surface — how a real screen reads on camera. */
export function ScreenSurface({
  texture,
  width,
  height,
  opacity = 1,
  additive = false,
  ...props
}: {
  texture: THREE.Texture;
  width: number;
  height: number;
  opacity?: number;
  additive?: boolean;
} & React.ComponentProps<'mesh'>) {
  return (
    <mesh {...props}>
      <planeGeometry args={[width, height]} />
      <meshBasicMaterial
        map={texture}
        transparent
        opacity={opacity}
        toneMapped={false}
        depthWrite={!additive}
        blending={additive ? THREE.AdditiveBlending : THREE.NormalBlending}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

/** Thin emissive strip used for edge lighting and underglows. */
export function GlowBar({
  width,
  height,
  color,
  intensity = 1,
  ...props
}: { width: number; height: number; color: string; intensity?: number } & React.ComponentProps<'mesh'>) {
  return (
    <mesh {...props}>
      <planeGeometry args={[width, height]} />
      <meshBasicMaterial color={color} transparent opacity={0.55 * intensity} toneMapped={false} blending={THREE.AdditiveBlending} depthWrite={false} />
    </mesh>
  );
}

/** Hairline wire frame around a volume — reads as engineered, not decorative. */
export function WireBox({
  size,
  color = '#66e0c0',
  opacity = 0.35,
  ...props
}: { size: [number, number, number]; color?: string; opacity?: number } & React.ComponentProps<'lineSegments'>) {
  const geometry = useMemo(() => new THREE.EdgesGeometry(new THREE.BoxGeometry(...size)), [size]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <lineSegments geometry={geometry} {...props}>
      <lineBasicMaterial color={color} transparent opacity={opacity} toneMapped={false} />
    </lineSegments>
  );
}

/** Ring of light used as a halo behind cores and nodes. */
export function Halo({
  radius,
  thickness = 0.02,
  color = '#66e0c0',
  opacity = 0.5,
  ...props
}: { radius: number; thickness?: number; color?: string; opacity?: number } & React.ComponentProps<'mesh'>) {
  const material = useRef<THREE.MeshBasicMaterial>(null);
  const presence = useIslandPresence();

  useFrame(() => {
    if (material.current) material.current.opacity = opacity * presence();
  });

  return (
    <mesh {...props}>
      <ringGeometry args={[radius, radius + thickness, 64]} />
      <meshBasicMaterial
        ref={material}
        color={color}
        transparent
        opacity={opacity}
        toneMapped={false}
        side={THREE.DoubleSide}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </mesh>
  );
}

export const MATTE = {
  color: '#0d121a',
  roughness: 0.62,
  metalness: 0.35,
} as const;

export const DARK_METAL = {
  color: '#151b25',
  roughness: 0.34,
  metalness: 0.85,
} as const;
