import { useEffect, useMemo, useRef, type ReactNode } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { ISLANDS } from './layout';
import { presenceAt } from '../hooks/usePresence';
import { IslandProvider, islandFade } from './IslandContext';
import type { SectionId } from '../data/portfolio';
import { Workstation } from '../models/workstation/Workstation';
import { AboutIsland } from '../models/islands/AboutIsland';
import { SkillsIsland } from '../models/islands/SkillsIsland';
import { ProjectsIsland } from '../models/islands/ProjectsIsland';
import { ExperienceIsland } from '../models/islands/ExperienceIsland';
import { ContactIsland } from '../models/islands/ContactIsland';

/**
 * Anchors one section's content in world space and hides it once the camera is
 * far enough away — invisible groups cost nothing to draw or raycast.
 */
function Island({
  id,
  index,
  span = 1.25,
  children,
}: {
  id: SectionId;
  index: number;
  span?: number;
  children: ReactNode;
}) {
  const ref = useRef<THREE.Group>(null);
  const last = useRef(-1);
  // Authored opacity per material, captured once so the fade always returns to
  // the look the component asked for.
  const base = useMemo(() => new Map<THREE.Material, { opacity: number; transparent: boolean }>(), []);

  useEffect(() => {
    const group = ref.current;
    if (!group) return;
    group.traverse((object) => {
      const material = (object as THREE.Mesh).material;
      if (!material) return;
      for (const m of Array.isArray(material) ? material : [material]) {
        if (!base.has(m)) base.set(m, { opacity: m.opacity, transparent: m.transparent });
      }
    });
  }, [base]);

  useFrame(() => {
    const group = ref.current;
    if (!group) return;

    const fade = islandFade(presenceAt(index, span));
    if (Math.abs(fade - last.current) < 0.004) return;
    last.current = fade;

    group.visible = fade > 0.004;
    if (!group.visible) return;

    // Components that animate their own opacity (screens, orbs, holograms)
    // multiply by the same fade in their own frame callback, which runs after
    // this one — so both paths land on the same value.
    group.traverse((object) => {
      const material = (object as THREE.Mesh).material;
      if (!material) return;
      for (const m of Array.isArray(material) ? material : [material]) {
        const authored = base.get(m);
        if (!authored) continue;
        if (fade > 0.995) {
          m.opacity = authored.opacity;
          m.transparent = authored.transparent;
        } else {
          m.transparent = true;
          m.opacity = authored.opacity * fade;
        }
      }
    });
  });

  return (
    <IslandProvider value={{ index, span }}>
      <group ref={ref} position={ISLANDS[id].position} rotation={[0, ISLANDS[id].rotationY, 0]}>
        {children}
      </group>
    </IslandProvider>
  );
}

export function World() {
  return (
    <>
      <Island id="hero" index={0} span={1.3}>
        <Workstation />
      </Island>
      <Island id="about" index={1}>
        <AboutIsland />
      </Island>
      <Island id="skills" index={2}>
        <SkillsIsland />
      </Island>
      <Island id="projects" index={3} span={1.4}>
        <ProjectsIsland />
      </Island>
      <Island id="experience" index={4}>
        <ExperienceIsland />
      </Island>
      <Island id="contact" index={5} span={1.5}>
        <ContactIsland />
      </Island>
    </>
  );
}
