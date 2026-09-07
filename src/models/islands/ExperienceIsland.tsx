import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { RoundedBox } from '@react-three/drei';
import * as THREE from 'three';
import { milestones, type Milestone } from '../../data/portfolio';
import {
  RESUME_ANCHOR,
  RESUME_ANCHOR_PORTRAIT,
  timelineNode,
  type Vec3,
} from '../../scenes/layout';
import { useCanvasTexture } from '../../lib/canvasTexture';
import { drawMilestone, drawResumePage } from '../../lib/screens';
import { HoloPanel } from '../HoloPanel';
import { Halo, useHover } from '../shared';
import { useAspect } from '../../hooks/useAspect';
import { useQualityContext } from '../../hooks/QualityContext';
import { useUI } from '../../state/ui';
import { journey } from '../../state/journey';
import { clamp, damp } from '../../animations/easing';
import { useIslandPresence } from '../../scenes/IslandContext';
import { profile } from '../../data/portfolio';

/** A milestone: glowing node, halo, and a label that wakes up when reached. */
function TimelineNode({
  milestone,
  position,
  index,
  portrait,
}: {
  milestone: Milestone;
  position: Vec3;
  index: number;
  portrait: boolean;
}) {
  const core = useRef<THREE.Mesh>(null);
  const halo = useRef<THREE.Mesh>(null);
  const light = useRef<THREE.PointLight>(null);
  const panel = useRef<THREE.Group>(null);
  const activeRef = useRef(0);
  const presence = useIslandPresence();

  // Every label sits above its node: the lower half of the frame belongs to
  // the copy block, and alternating sides used to collide with it.
  const labelOffset: Vec3 = portrait
    ? [1.5, 0.04, 0.15]
    : [0.12, index % 2 === 0 ? 1.62 : 1.05, 0.15];

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.1);
    const t = state.clock.elapsedTime;
    const reach = clamp(journey.band * (milestones.length - 1) - index + 0.8, 0, 1);
    const active = clamp(1 - Math.abs(journey.band * (milestones.length - 1) - index) * 1.1);
    activeRef.current = damp(activeRef.current, Math.max(active, reach * 0.35), 5, dt);
    const a = activeRef.current;

    const p = presence();
    if (core.current) {
      const mat = core.current.material as THREE.MeshBasicMaterial;
      mat.opacity = (0.35 + a * 0.65) * p;
      core.current.scale.setScalar(0.7 + a * 0.5 + Math.sin(t * 2 + index) * 0.03 * a);
    }
    if (halo.current) {
      const mat = halo.current.material as THREE.MeshBasicMaterial;
      mat.opacity = (0.12 + a * 0.5) * p;
      halo.current.scale.setScalar(1 + a * 0.35 + Math.sin(t * 1.4 + index) * 0.04);
    }
    if (light.current) light.current.intensity = (0.6 + a * 5.5) * p;
    if (panel.current) {
      panel.current.position.x = damp(panel.current.position.x, labelOffset[0] + (1 - a) * -0.25, 4, dt);
      panel.current.scale.setScalar(damp(panel.current.scale.x, 0.9 + a * 0.1, 5, dt));
    }
  });

  return (
    <group position={position}>
      <mesh ref={core}>
        <sphereGeometry args={[0.085, 16, 16]} />
        <meshBasicMaterial color="#66e0c0" transparent opacity={0.6} toneMapped={false} />
      </mesh>
      <mesh ref={halo} rotation={portrait ? [0, 0, 0] : [0, 0, 0]}>
        <ringGeometry args={[0.16, 0.175, 40]} />
        <meshBasicMaterial
          color="#66e0c0"
          transparent
          opacity={0.3}
          toneMapped={false}
          side={THREE.DoubleSide}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
      <pointLight ref={light} color="#66e0c0" intensity={2} distance={3.2} decay={2} />

      <group ref={panel} position={labelOffset}>
        <HoloPanel
          draw={drawMilestone(milestone)}
          width={2.7}
          height={0.95}
          position={[portrait ? 1.2 : 1.33, 0, 0]}
          parallax={0.05}
          float={0.02}
          phase={index * 1.3}
          deps={[milestone.id]}
        />
        {/* tick joining the node to its label */}
        <mesh position={[-0.16, 0, 0]}>
          <planeGeometry args={[0.045, 0.62]} />
          <meshBasicMaterial color="#66e0c0" transparent opacity={0.3} toneMapped={false} />
        </mesh>
      </group>
    </group>
  );
}

/** A printed-looking document you can pick up — opens the resume preview. */
function ResumeDocument({ position }: { position: Vec3 }) {
  const group = useRef<THREE.Group>(null);
  const quality = useQualityContext();
  const { setResumeOpen } = useUI();
  const { hovered, bind } = useHover();

  const texture = useCanvasTexture(
    Math.round(720 * quality.textureScale),
    Math.round(1000 * quality.textureScale),
    drawResumePage(profile.name, profile.role),
  );

  useFrame((state, delta) => {
    const g = group.current;
    if (!g) return;
    const dt = Math.min(delta, 0.1);
    const t = state.clock.elapsedTime;
    g.rotation.y = damp(g.rotation.y, -0.32 + (hovered ? 0.24 : 0) + Math.sin(t * 0.4) * 0.05, 3.5, dt);
    g.rotation.z = damp(g.rotation.z, hovered ? 0 : -0.06, 3.5, dt);
    g.position.y = damp(g.position.y, position[1] + (hovered ? 0.16 : 0) + Math.sin(t * 0.6) * 0.05, 3.5, dt);
    g.scale.setScalar(damp(g.scale.x, hovered ? 1.06 : 1, 6, dt));
  });

  return (
    <group
      ref={group}
      position={position}
      onPointerOver={bind.onPointerOver}
      onPointerOut={bind.onPointerOut}
      onClick={(event) => {
        event.stopPropagation();
        setResumeOpen(true);
      }}
    >
      <RoundedBox args={[0.95, 1.32, 0.012]} radius={0.006} smoothness={2}>
        <meshStandardMaterial color="#e9edf3" roughness={0.85} metalness={0.02} />
      </RoundedBox>
      <mesh position={[0, 0, 0.0075]}>
        <planeGeometry args={[0.93, 1.3]} />
        <meshBasicMaterial map={texture} toneMapped={false} />
      </mesh>

      {/* sheet behind, for weight */}
      <mesh position={[0.02, -0.02, -0.014]} rotation={[0, 0, 0.02]}>
        <planeGeometry args={[0.93, 1.3]} />
        <meshStandardMaterial color="#c9d1dd" roughness={0.9} />
      </mesh>

      <HoloPanel
        draw={(ctx, w, h) => {
          ctx.clearRect(0, 0, w, h);
          ctx.fillStyle = 'rgba(102,224,192,0.9)';
          ctx.font = `500 ${h * 0.5}px "JetBrains Mono", monospace`;
          ctx.textAlign = 'center';
          ctx.fillText('VIEW RESUME', w / 2, h * 0.68);
        }}
        width={0.9}
        height={0.16}
        position={[0, -0.82, 0.06]}
        parallax={0}
        float={0}
      />
      <pointLight position={[0, 0, 0.8]} color="#ffffff" intensity={hovered ? 2.6 : 1.1} distance={2.4} decay={2} />
    </group>
  );
}

export function ExperienceIsland() {
  const { portrait } = useAspect();
  const quality = useQualityContext();
  const railMat = useRef<THREE.MeshBasicMaterial>(null);
  const presence = useIslandPresence();

  useFrame(() => {
    if (railMat.current) railMat.current.opacity = 0.42 * presence();
  });

  const nodes = useMemo(
    () => milestones.map((m, i) => ({ m, position: timelineNode(i, milestones.length, portrait) })),
    [portrait],
  );

  const rail = useMemo(() => {
    const points = nodes.map(({ position }) => new THREE.Vector3(...position));
    const curve = new THREE.CatmullRomCurve3(points, false, 'catmullrom', 0.4);
    return new THREE.TubeGeometry(curve, 64, 0.006, 6, false);
  }, [nodes]);

  return (
    <group scale={portrait ? 0.82 : 1}>
      <mesh geometry={rail}>
        <meshBasicMaterial ref={railMat} color="#66e0c0" transparent opacity={0.42} toneMapped={false} />
      </mesh>

      {nodes.map(({ m, position }, i) => (
        <TimelineNode key={m.id} milestone={m} position={position} index={i} portrait={portrait} />
      ))}

      <ResumeDocument position={portrait ? RESUME_ANCHOR_PORTRAIT : RESUME_ANCHOR} />

      {quality.props && (
        <Halo
          radius={0.55}
          thickness={0.003}
          color="#8ab6ff"
          opacity={0.25}
          position={portrait ? [1.6, 3.4, -1.2] : [-6.4, 1.5, -1.6]}
          rotation={[0.6, 0.3, 0]}
        />
      )}
    </group>
  );
}
