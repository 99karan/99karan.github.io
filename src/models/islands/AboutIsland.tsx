import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { HoloPanel } from '../HoloPanel';
import { Halo } from '../shared';
import { drawProfilePanel, drawStatPlate } from '../../lib/screens';
import { profile, stats } from '../../data/portfolio';
import { useAspect } from '../../hooks/useAspect';
import { useQualityContext } from '../../hooks/QualityContext';
import { PALETTE } from '../../lib/palette';

const STAT_COLORS = [PALETTE.accent, PALETTE.blue, PALETTE.amber, PALETTE.accent];

/** Slow wireframe shell that gives the panel something to sit in front of. */
function DataShell() {
  const ref = useRef<THREE.Group>(null);
  const geometry = useMemo(() => new THREE.IcosahedronGeometry(2.15, 1), []);
  const edges = useMemo(() => new THREE.EdgesGeometry(geometry), [geometry]);

  useFrame((state, delta) => {
    if (!ref.current) return;
    ref.current.rotation.y += delta * 0.045;
    ref.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.12) * 0.1;
  });

  return (
    <group ref={ref}>
      <lineSegments geometry={edges}>
        <lineBasicMaterial color="#1c3a44" transparent opacity={0.5} toneMapped={false} />
      </lineSegments>
    </group>
  );
}

export function AboutIsland() {
  const { portrait } = useAspect();
  const quality = useQualityContext();
  const shift = portrait ? 0 : 1.35;
  const scale = portrait ? 0.72 : 1;

  const statSlots: [number, number][] = portrait
    ? [
        [-0.78, -1.28],
        [0.78, -1.28],
        [-0.78, -1.96],
        [0.78, -1.96],
      ]
    : [
        [-0.72, -0.78],
        [0.78, -0.78],
        [-0.72, -1.46],
        [0.78, -1.46],
      ];

  return (
    <group position={[shift, 0, 0]} scale={scale}>
      <group position={[0, 0.45, -1.4]}>
        <DataShell />
      </group>

      <HoloPanel
        draw={drawProfilePanel(profile.name, profile.role, profile.location)}
        width={2.85}
        height={1.55}
        position={[0, 0.62, 0]}
        parallax={0.09}
        phase={0.4}
      />

      {stats.map((stat, i) => (
        <HoloPanel
          key={stat.label}
          draw={drawStatPlate(stat.value, stat.label, stat.note, STAT_COLORS[i % STAT_COLORS.length])}
          width={1.38}
          height={0.6}
          position={[statSlots[i][0], statSlots[i][1], 0.2 + (i % 2) * 0.1]}
          parallax={0.11 + i * 0.015}
          float={0.028}
          phase={i * 1.6}
        />
      ))}

      <Halo radius={0.9} thickness={0.006} color={PALETTE.accent} opacity={0.28} position={[0, 0.6, -1.9]} />
      {quality.props && (
        <>
          <Halo
            radius={1.35}
            thickness={0.004}
            color={PALETTE.blue}
            opacity={0.2}
            position={[0, 0.6, -2.1]}
            rotation={[0.4, 0.2, 0]}
          />
          <mesh position={[-2.35, 1.35, -0.6]}>
            <octahedronGeometry args={[0.13, 0]} />
            <meshStandardMaterial color="#131a23" roughness={0.25} metalness={1} flatShading envMapIntensity={1.4} />
          </mesh>
        </>
      )}
      <pointLight position={[0, 0.6, 1.4]} color={PALETTE.accent} intensity={5} distance={5.5} decay={2} />
    </group>
  );
}
