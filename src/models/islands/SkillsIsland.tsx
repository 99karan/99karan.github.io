import { useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Billboard } from '@react-three/drei';
import * as THREE from 'three';
import { skills, type Skill } from '../../data/portfolio';
import { useCanvasTexture } from '../../lib/canvasTexture';
import { drawSkillLabel } from '../../lib/screens';
import { useQualityContext } from '../../hooks/QualityContext';
import { useAspect } from '../../hooks/useAspect';
import { useUI } from '../../state/ui';
import { useHover, Halo } from '../shared';
import { damp } from '../../animations/easing';
import { journey } from '../../state/journey';

const RING_RADII = [1.6, 2.4, 3.15];
const RING_TILT: [number, number][] = [
  [0.42, 0.1],
  [-0.3, -0.22],
  [0.6, 0.28],
];
const RING_SPEED = [0.13, -0.085, 0.058];

interface OrbProps {
  skill: Skill;
  index: number;
  ringIndex: number;
  angle: number;
  radius: number;
  active: string | null;
}

function SkillOrb({ skill, index, ringIndex, angle, radius, active }: OrbProps) {
  const group = useRef<THREE.Group>(null);
  const mesh = useRef<THREE.Mesh>(null);
  const labelMat = useRef<THREE.MeshBasicMaterial>(null);
  const quality = useQualityContext();
  const { camera } = useThree();
  const { setHoveredSkill } = useUI();
  const { hovered, bind } = useHover();

  const texture = useCanvasTexture(
    Math.round(384 * Math.max(0.7, quality.textureScale)),
    Math.round(96 * Math.max(0.7, quality.textureScale)),
    drawSkillLabel(skill.name, skill.accent),
    [skill.name, skill.accent],
  );

  const euler = useMemo(
    () => new THREE.Euler(RING_TILT[ringIndex][0], 0, RING_TILT[ringIndex][1]),
    [ringIndex],
  );
  const scratch = useMemo(
    () => ({ base: new THREE.Vector3(), cam: new THREE.Vector3(), dir: new THREE.Vector3() }),
    [],
  );

  const isActive = active === skill.name;
  const dimmed = active !== null && !isActive;

  useFrame((state, delta) => {
    const g = group.current;
    if (!g || !g.parent) return;
    const dt = Math.min(delta, 0.1);
    const t = state.clock.elapsedTime;
    const { base, cam, dir } = scratch;

    const a = angle + t * RING_SPEED[ringIndex];
    base.set(Math.cos(a) * radius, 0, Math.sin(a) * radius).applyEuler(euler);
    base.y += Math.sin(t * 0.7 + index) * 0.06;

    if (isActive) {
      cam.copy(camera.position);
      g.parent.worldToLocal(cam);
      dir.copy(cam).sub(base).normalize();
      base.addScaledVector(dir, 1.15);
    }

    g.position.x = damp(g.position.x, base.x, 5, dt);
    g.position.y = damp(g.position.y, base.y, 5, dt);
    g.position.z = damp(g.position.z, base.z, 5, dt);

    const scale = isActive ? 1.65 : hovered ? 1.25 : 1;
    const s = damp(g.scale.x, scale, 7, dt);
    g.scale.setScalar(s);

    if (mesh.current) {
      mesh.current.rotation.x += dt * 0.35;
      mesh.current.rotation.y += dt * 0.5;
      const mat = mesh.current.material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity = damp(mat.emissiveIntensity, isActive ? 2.6 : dimmed ? 0.22 : 0.9, 6, dt);
      mat.opacity = damp(mat.opacity, dimmed ? 0.45 : 1, 6, dt);
    }

    if (labelMat.current) {
      const target = isActive ? 1 : dimmed ? 0.16 : 0.6;
      labelMat.current.opacity = damp(labelMat.current.opacity, target * (0.35 + journey.local * 0.65), 6, dt);
    }
  });

  return (
    <group
      ref={group}
      onPointerOver={(event) => {
        bind.onPointerOver(event);
        setHoveredSkill(skill.name);
      }}
      onPointerOut={(event) => {
        bind.onPointerOut(event);
        setHoveredSkill(null);
      }}
      onClick={(event) => {
        event.stopPropagation();
        setHoveredSkill(skill.name);
      }}
    >
      <mesh ref={mesh}>
        <octahedronGeometry args={[0.15, 0]} />
        <meshStandardMaterial
          color="#0d141c"
          emissive={skill.accent}
          emissiveIntensity={0.9}
          roughness={0.24}
          metalness={0.9}
          transparent
          flatShading
          envMapIntensity={1.5}
        />
      </mesh>

      {/* invisible, generous hit area — small orbs are hard to hover */}
      <mesh visible={false}>
        <sphereGeometry args={[0.36, 8, 8]} />
        <meshBasicMaterial />
      </mesh>

      <Billboard position={[0, 0.32, 0]}>
        <mesh>
          <planeGeometry args={[0.86, 0.215]} />
          <meshBasicMaterial
            ref={labelMat}
            map={texture}
            transparent
            opacity={0.6}
            depthWrite={false}
            toneMapped={false}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
      </Billboard>
    </group>
  );
}

/** Glowing centre the whole skill system orbits. */
function Core() {
  const shell = useRef<THREE.Mesh>(null);
  const inner = useRef<THREE.Mesh>(null);
  const light = useRef<THREE.PointLight>(null);
  const quality = useQualityContext();

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime;
    if (shell.current) {
      shell.current.rotation.y += delta * 0.12;
      shell.current.rotation.x -= delta * 0.06;
    }
    if (inner.current) {
      inner.current.rotation.y -= delta * 0.28;
      inner.current.scale.setScalar(1 + Math.sin(t * 1.4) * 0.035);
    }
    if (light.current) light.current.intensity = 9 + Math.sin(t * 1.9) * 1.2;
  });

  return (
    <group>
      <mesh ref={inner}>
        <icosahedronGeometry args={[0.38, quality.tier === 'low' ? 0 : 1]} />
        <meshBasicMaterial color="#66e0c0" toneMapped={false} />
      </mesh>
      <mesh ref={shell}>
        <icosahedronGeometry args={[0.72, 1]} />
        <meshBasicMaterial color="#66e0c0" wireframe transparent opacity={0.28} toneMapped={false} />
      </mesh>
      <pointLight ref={light} color="#66e0c0" intensity={9} distance={9} decay={2} />
    </group>
  );
}

export function SkillsIsland() {
  const { portrait } = useAspect();
  const { hoveredSkill } = useUI();
  const quality = useQualityContext();
  const rings = useRef<THREE.Group>(null);

  const placed = useMemo(() => {
    const byRing: Record<number, Skill[]> = { 0: [], 1: [], 2: [] };
    skills.forEach((s) => byRing[s.ring].push(s));
    return skills.map((skill, index) => {
      const siblings = byRing[skill.ring];
      const position = siblings.indexOf(skill);
      return {
        skill,
        index,
        ringIndex: skill.ring,
        angle: (position / siblings.length) * Math.PI * 2 + skill.ring * 0.8,
        radius: RING_RADII[skill.ring],
      };
    });
  }, []);

  useFrame((_, delta) => {
    if (rings.current) rings.current.rotation.y += delta * 0.02;
  });

  return (
    <group position={[portrait ? 0 : 0.7, 0, 0]} scale={portrait ? 0.66 : 1}>
      <Core />

      <group ref={rings}>
        {RING_RADII.map((radius, i) => (
          <Halo
            key={radius}
            radius={radius}
            thickness={0.004}
            color={i === 1 ? '#8ab6ff' : '#66e0c0'}
            opacity={0.16}
            rotation={[RING_TILT[i][0] + Math.PI / 2, 0, RING_TILT[i][1]]}
          />
        ))}
      </group>

      {placed.map((item) => (
        <SkillOrb key={item.skill.name} {...item} active={hoveredSkill} />
      ))}

      {quality.props && (
        <Halo radius={4.1} thickness={0.003} color="#1d3d44" opacity={0.5} rotation={[Math.PI / 2, 0, 0]} />
      )}
    </group>
  );
}
