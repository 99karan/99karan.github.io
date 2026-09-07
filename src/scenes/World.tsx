import { useRef, type ReactNode } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { ISLANDS } from './layout';
import { presenceAt } from '../hooks/usePresence';
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
  span = 1.45,
  children,
}: {
  id: SectionId;
  index: number;
  span?: number;
  children: ReactNode;
}) {
  const ref = useRef<THREE.Group>(null);

  useFrame(() => {
    if (!ref.current) return;
    ref.current.visible = presenceAt(index, span) > 0.015;
  });

  return (
    <group ref={ref} position={ISLANDS[id].position} rotation={[0, ISLANDS[id].rotationY, 0]}>
      {children}
    </group>
  );
}

export function World() {
  return (
    <>
      <Island id="hero" index={0} span={1.6}>
        <Workstation />
      </Island>
      <Island id="about" index={1}>
        <AboutIsland />
      </Island>
      <Island id="skills" index={2}>
        <SkillsIsland />
      </Island>
      <Island id="projects" index={3} span={1.6}>
        <ProjectsIsland />
      </Island>
      <Island id="experience" index={4}>
        <ExperienceIsland />
      </Island>
      <Island id="contact" index={5} span={1.8}>
        <ContactIsland />
      </Island>
    </>
  );
}
