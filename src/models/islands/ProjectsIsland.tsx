import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { RoundedBox } from '@react-three/drei';
import * as THREE from 'three';
import { projects, type Project } from '../../data/portfolio';
import { projectSlots, type Slot } from '../../scenes/layout';
import { useCanvasTexture } from '../../lib/canvasTexture';
import { drawProjectMock, drawTitlePlate } from '../../lib/screens';
import { useQualityContext } from '../../hooks/QualityContext';
import { useAspect } from '../../hooks/useAspect';
import { useUI } from '../../state/ui';
import { useHover, Halo } from '../shared';
import { HoloPanel } from '../HoloPanel';
import { useProjectImage } from '../../hooks/useProjectImage';
import { damp } from '../../animations/easing';
import { useIslandPresence } from '../../scenes/IslandContext';

const SCREEN_W = 3;
const SCREEN_H = 1.9;

interface ScreenProps {
  project: Project;
  slot: Slot;
  focused: string | null;
}

/** One floating device in the gallery: frame, screen, glow, hit target. */
function ProjectScreen({ project, slot, focused }: ScreenProps) {
  const group = useRef<THREE.Group>(null);
  const frameRef = useRef<THREE.Mesh>(null);
  const screenMat = useRef<THREE.MeshBasicMaterial>(null);
  const rim = useRef<THREE.Mesh>(null);
  const quality = useQualityContext();
  const { setFocus } = useUI();
  const { hovered, bind } = useHover();
  const presence = useIslandPresence();

  // Project screens are the one surface the camera pushes right up against.
  const fallback = useCanvasTexture(
    Math.round(1600 * quality.textureScale),
    Math.round(1000 * quality.textureScale),
    drawProjectMock(project),
    [project.id],
  );
  const texture = useProjectImage(project.image, fallback);

  const isFocused = focused === project.id;
  const dimmed = focused !== null && !isFocused;
  const accent = useMemo(() => new THREE.Color(project.accent), [project.accent]);

  useFrame((state, delta) => {
    const g = group.current;
    if (!g) return;
    const dt = Math.min(delta, 0.1);
    const t = state.clock.elapsedTime;

    const lift = (hovered && !focused ? 0.18 : 0) + (isFocused ? 0.1 : 0);
    const bob = Math.sin(t * 0.5 + slot.position[0]) * 0.045;
    g.position.y = damp(g.position.y, slot.position[1] + lift + bob, 4, dt);
    g.position.z = damp(g.position.z, slot.position[2] + (hovered && !focused ? 0.22 : 0), 4, dt);

    const target = slot.scale * (isFocused ? 1.06 : hovered ? 1.03 : 1);
    g.scale.setScalar(damp(g.scale.x, target, 6, dt));

    const p = presence();
    if (screenMat.current) {
      screenMat.current.opacity = damp(screenMat.current.opacity, dimmed ? 0.28 : 1, 5, dt) * p;
    }
    if (rim.current) {
      const mat = rim.current.material as THREE.MeshBasicMaterial;
      mat.opacity = damp(mat.opacity, isFocused ? 0.9 : hovered ? 0.7 : dimmed ? 0.05 : 0.3, 6, dt) * p;
    }
    if (frameRef.current) {
      const mat = frameRef.current.material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity = damp(mat.emissiveIntensity, isFocused || hovered ? 0.5 : 0.12, 6, dt);
    }
  });

  return (
    <group
      ref={group}
      position={slot.position}
      rotation={[0, slot.rotationY, 0]}
      scale={slot.scale}
      onPointerOver={bind.onPointerOver}
      onPointerOut={bind.onPointerOut}
      onClick={(event) => {
        event.stopPropagation();
        setFocus(isFocused ? null : project.id);
      }}
    >
      <RoundedBox
        ref={frameRef}
        args={[SCREEN_W + 0.09, SCREEN_H + 0.09, 0.05]}
        radius={0.016}
        smoothness={3}
        position={[0, 0, -0.03]}
        castShadow={false}
      >
        <meshStandardMaterial
          color="#0a0e14"
          roughness={0.38}
          metalness={0.82}
          emissive={accent}
          emissiveIntensity={0.12}
          envMapIntensity={1.1}
        />
      </RoundedBox>

      <mesh>
        <planeGeometry args={[SCREEN_W, SCREEN_H]} />
        <meshBasicMaterial ref={screenMat} map={texture} transparent toneMapped={false} />
      </mesh>

      {/* rim light along the bottom edge */}
      <mesh ref={rim} position={[0, -SCREEN_H / 2 - 0.055, 0.01]}>
        <planeGeometry args={[SCREEN_W * 0.86, 0.016]} />
        <meshBasicMaterial color={accent} transparent opacity={0.3} toneMapped={false} />
      </mesh>

      {/* pedestal stem so screens read as installed, not pasted */}
      <mesh position={[0, -SCREEN_H / 2 - 0.34, -0.02]}>
        <boxGeometry args={[0.03, 0.55, 0.03]} />
        <meshStandardMaterial color="#141b25" roughness={0.34} metalness={0.9} />
      </mesh>
      <Halo
        radius={0.24}
        thickness={0.004}
        color={project.accent}
        opacity={0.35}
        position={[0, -SCREEN_H / 2 - 0.62, -0.02]}
        rotation={[-Math.PI / 2, 0, 0]}
      />

      <pointLight
        position={[0, 0, 0.9]}
        color={accent}
        intensity={isFocused || hovered ? 3.4 : 1.4}
        distance={3.4}
        decay={2}
      />
    </group>
  );
}

export function ProjectsIsland() {
  const { portrait } = useAspect();
  const { focus } = useUI();
  const slots = useMemo(() => projectSlots(projects.length, portrait), [portrait]);

  return (
    <group>
      <HoloPanel
        draw={drawTitlePlate('SELECTED WORK', 'SELECT A SCREEN TO OPEN')}
        width={2.6}
        height={0.62}
        position={[0, portrait ? 3.5 : 3.42, portrait ? -1 : -1.6]}
        parallax={0.05}
        float={0.02}
      />
      {projects.map((project, i) => (
        <ProjectScreen key={project.id} project={project} slot={slots[i]} focused={focus} />
      ))}
    </group>
  );
}
