import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { skills } from '../../data/portfolio';
import { sound } from '../audio';
import { runtime, store, useStore } from '../state';
import { fx } from '../vehicles/Effects';
import { tokens, type Token } from './placements';

/**
 * Ten skill gems hidden around the island — some need the car, some the boat,
 * some a helicopter or a plane. A beam of light marks each one from afar.
 */

const RADIUS = { car: 4.5, bike: 4.5, boat: 6, heli: 7, plane: 11 } as const;

function Gem({ token, collected }: { token: Token; collected: boolean }) {
  const group = useRef<THREE.Group>(null);
  const skill = skills.find((s) => s.name === token.skill)!;
  const mats = useMemo(
    () => ({
      gem: new THREE.MeshStandardMaterial({ color: skill.accent, emissive: skill.accent, emissiveIntensity: 2.2, roughness: 0.2, metalness: 0.3 }),
      ring: new THREE.MeshBasicMaterial({ color: skill.accent, transparent: true, opacity: 0.8 }),
      beam: new THREE.MeshBasicMaterial({ color: skill.accent, transparent: true, opacity: 0.12, depthWrite: false, blending: THREE.AdditiveBlending }),
    }),
    [skill],
  );
  const done = useRef(collected);
  done.current = collected;

  useFrame(({ clock }) => {
    const g = group.current;
    if (!g) return;
    const t = clock.elapsedTime;
    g.rotation.y = t * 1.4;
    g.position.y = token.y + Math.sin(t * 2 + token.x) * 0.25;
    if (done.current) return;

    const p = runtime.position;
    const r = RADIUS[store.get().vehicle];
    const d = Math.hypot(p.x - token.x, p.y + 1 - token.y, p.z - token.z);
    if (d < r && store.collect(token.skill)) {
      fx.burst('sparkle', token.x, token.y, token.z, 50, 8);
      sound.play('collect');
      const n = store.get().collected.length;
      store.toast(
        n === tokens.length
          ? { title: 'Every skill unlocked!', body: 'You found all ten. Thanks for exploring.', tone: 'skill' }
          : { title: `Skill unlocked: ${skill.name}`, body: `${skill.detail} · ${n}/${tokens.length}`, tone: 'skill' },
        4200,
      );
    }
  });

  if (collected) return null;
  return (
    <group>
      <mesh position={[token.x, token.y + 40, token.z]} material={mats.beam}>
        <cylinderGeometry args={[0.5, 0.5, 80, 10, 1, true]} />
      </mesh>
      <group ref={group} position={[token.x, token.y, token.z]}>
        <mesh material={mats.gem} castShadow>
          <octahedronGeometry args={[0.85, 0]} />
        </mesh>
        <mesh rotation-x={Math.PI / 2} material={mats.ring}>
          <torusGeometry args={[1.4, 0.06, 8, 40]} />
        </mesh>
      </group>
    </group>
  );
}

export function Collectibles() {
  const collected = useStore((s) => s.collected);
  return (
    <group>
      {tokens.map((t) => (
        <Gem key={t.skill} token={t} collected={collected.includes(t.skill)} />
      ))}
    </group>
  );
}
