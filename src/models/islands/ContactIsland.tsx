import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { socials } from '../../data/portfolio';
import { useCanvasTexture } from '../../lib/canvasTexture';
import { drawSocialIcon } from '../../lib/screens';
import { useQualityContext } from '../../hooks/QualityContext';
import { useAspect } from '../../hooks/useAspect';
import { Halo, useHover } from '../shared';
import { damp } from '../../animations/easing';
import { PALETTE } from '../../lib/palette';

type Social = (typeof socials)[number];

function SocialPlate({ social, position, index }: { social: Social; position: [number, number, number]; index: number }) {
  const group = useRef<THREE.Group>(null);
  const mat = useRef<THREE.MeshBasicMaterial>(null);
  const ring = useRef<THREE.Mesh>(null);
  const quality = useQualityContext();
  const { hovered, bind } = useHover();

  const texture = useCanvasTexture(
    Math.round(384 * Math.max(0.7, quality.textureScale)),
    Math.round(384 * Math.max(0.7, quality.textureScale)),
    drawSocialIcon(social.id, social.label, PALETTE.accent),
    [social.id],
  );

  useFrame((state, delta) => {
    const g = group.current;
    if (!g) return;
    const dt = Math.min(delta, 0.1);
    const t = state.clock.elapsedTime;
    g.position.y = damp(g.position.y, position[1] + (hovered ? 0.16 : 0) + Math.sin(t * 0.55 + index) * 0.06, 4, dt);
    g.scale.setScalar(damp(g.scale.x, hovered ? 1.12 : 1, 7, dt));
    if (mat.current) mat.current.opacity = damp(mat.current.opacity, hovered ? 1 : 0.72, 6, dt);
    if (ring.current) {
      const m = ring.current.material as THREE.MeshBasicMaterial;
      m.opacity = damp(m.opacity, hovered ? 0.55 : 0.16, 6, dt);
      ring.current.rotation.z += dt * (hovered ? 0.5 : 0.12);
    }
  });

  return (
    <group
      ref={group}
      position={position}
      onPointerOver={bind.onPointerOver}
      onPointerOut={bind.onPointerOut}
      onClick={(event) => {
        event.stopPropagation();
        window.open(social.url, social.url.startsWith('mailto:') ? '_self' : '_blank', 'noopener,noreferrer');
      }}
    >
      <mesh>
        <planeGeometry args={[1.05, 1.05]} />
        <meshBasicMaterial
          ref={mat}
          map={texture}
          transparent
          opacity={0.72}
          depthWrite={false}
          toneMapped={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
      <mesh ref={ring} position={[0, 0.06, -0.02]}>
        <ringGeometry args={[0.5, 0.505, 48]} />
        <meshBasicMaterial
          color={PALETTE.accent}
          transparent
          opacity={0.16}
          toneMapped={false}
          side={THREE.DoubleSide}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
      {/* hit area */}
      <mesh visible={false}>
        <planeGeometry args={[1.15, 1.15]} />
        <meshBasicMaterial />
      </mesh>
      <pointLight position={[0, 0, 0.6]} color={PALETTE.accent} intensity={hovered ? 2.2 : 0.5} distance={2.4} decay={2} />
    </group>
  );
}

/** The last room: an open horizon, a slow portal ring, and three ways to reach out. */
export function ContactIsland() {
  const { portrait } = useAspect();
  const quality = useQualityContext();
  const portal = useRef<THREE.Group>(null);
  const motes = useRef<THREE.Points>(null);

  const moteGeometry = useMemo(() => {
    const count = Math.round(quality.particles * 0.22);
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 2 + Math.random() * 6;
      positions[i * 3] = Math.cos(a) * r;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 6;
      positions[i * 3 + 2] = Math.sin(a) * r * 0.6 - 2;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    return geo;
  }, [quality.particles]);

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime;
    if (portal.current) {
      portal.current.rotation.z += delta * 0.03;
      portal.current.scale.setScalar(1 + Math.sin(t * 0.35) * 0.015);
    }
    if (motes.current) motes.current.rotation.y = t * 0.04;
  });

  const spacing = portrait ? 1.4 : 2.3;
  const iconY = portrait ? -2.9 : -2.1;

  return (
    <group scale={portrait ? 0.85 : 1}>
      <group ref={portal} position={[0, 0.2, -3.4]}>
        <Halo radius={3.4} thickness={0.012} color={PALETTE.accent} opacity={0.32} />
        <Halo radius={4.3} thickness={0.004} color={PALETTE.blue} opacity={0.16} />
        {quality.props && <Halo radius={5.4} thickness={0.003} color={PALETTE.accent} opacity={0.08} />}
      </group>

      <points ref={motes} geometry={moteGeometry} position={[0, 0, -1]}>
        <pointsMaterial
          size={0.035}
          color={PALETTE.accent}
          transparent
          opacity={0.55}
          depthWrite={false}
          sizeAttenuation
          blending={THREE.AdditiveBlending}
        />
      </points>

      {socials.map((social, i) => (
        <SocialPlate
          key={social.id}
          social={social}
          index={i}
          position={[(i - 1) * spacing, iconY, 0.4]}
        />
      ))}

      <pointLight position={[0, 0, 2]} color={PALETTE.accent} intensity={6} distance={9} decay={2} />
    </group>
  );
}
