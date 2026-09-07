import { useRef } from 'react';
import { Hero } from '../sections/Hero';
import { About } from '../sections/About';
import { Skills } from '../sections/Skills';
import { Projects } from '../sections/Projects';
import { Experience } from '../sections/Experience';
import { Contact } from '../sections/Contact';
import { useJourneyFrame } from '../hooks/useJourney';
import { journey } from '../state/journey';
import { clamp, smootherstep } from '../animations/easing';
import { useUI } from '../state/ui';
import { sectionOrder } from '../data/portfolio';

const PANELS = [
  { id: 'hero', node: <Hero /> },
  { id: 'about', node: <About /> },
  { id: 'skills', node: <Skills /> },
  { id: 'projects', node: <Projects /> },
  { id: 'experience', node: <Experience /> },
  { id: 'contact', node: <Contact /> },
] as const;

/**
 * Copy lives in the DOM, not in WebGL: it stays selectable, translatable and
 * readable by assistive tech. Each panel is faded by the same `flow` value that
 * drives the camera, so text and camera arrive together.
 */
export function SectionPanels() {
  const refs = useRef<(HTMLElement | null)[]>([]);
  const { focus, resumeOpen } = useUI();
  const suppressed = useRef(false);
  suppressed.current = focus !== null || resumeOpen;

  useJourneyFrame(() => {
    const veil = suppressed.current ? 0.12 : 1;
    for (let i = 0; i < refs.current.length; i++) {
      const el = refs.current[i];
      if (!el) continue;
      const distance = Math.abs(journey.flow - i);
      const visible = distance < 0.62;
      const opacity = smootherstep(clamp(1 - distance * 2.1)) * veil;
      const shift = (journey.flow - i) * 34;

      el.style.opacity = opacity.toFixed(3);
      el.style.transform = `translate3d(0, ${shift.toFixed(1)}px, 0)`;
      const next = visible ? 'true' : 'false';
      if (el.dataset.visible !== next) {
        el.dataset.visible = next;
        el.setAttribute('aria-hidden', visible ? 'false' : 'true');
      }
      // NB: the panel itself always stays transparent to pointers — its
      // children opt in via CSS. Making it `auto` would swallow every hover
      // and click meant for the 3D scene behind it.
      const inert = !visible || suppressed.current;
      if (el.dataset.inert !== String(inert)) el.dataset.inert = String(inert);
    }
  });

  return (
    <div className="panels">
      {PANELS.map((panel, i) => (
        <section
          key={panel.id}
          id={sectionOrder[i]}
          className={`panel panel--${panel.id}`}
          data-visible={i === 0 ? 'true' : 'false'}
          ref={(el) => {
            refs.current[i] = el;
          }}
        >
          {panel.node}
        </section>
      ))}
    </div>
  );
}
