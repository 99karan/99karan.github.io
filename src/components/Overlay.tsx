import { useRef } from 'react';
import { profile } from '../data/portfolio';
import { useJourneyFrame } from '../hooks/useJourney';
import { journey } from '../state/journey';
import { clamp } from '../animations/easing';

/** Hero scroll cue and the closing colophon — both tied to journey position. */
export function Ambience() {
  const cue = useRef<HTMLDivElement>(null);
  const colophon = useRef<HTMLDivElement>(null);
  const fade = useRef<HTMLDivElement>(null);

  useJourneyFrame(() => {
    if (cue.current) cue.current.style.opacity = clamp(1 - journey.flow * 1.6).toFixed(3);
    if (colophon.current) colophon.current.style.opacity = clamp((journey.flow - 4.2) * 1.2).toFixed(3);
    if (fade.current) fade.current.style.opacity = journey.outro.toFixed(3);
  });

  return (
    <>
      <div className="herofoot" ref={cue}>
        <div className="cue">
          <span className="mono">Scroll to travel</span>
          <span className="cue__line" aria-hidden="true" />
        </div>
        <span className="mono">{profile.resume.updated}</span>
      </div>

      <div className="colophon" ref={colophon} style={{ opacity: 0 }}>
        <span className="mono">Built with React Three Fiber · Three.js · GSAP</span>
        <span className="mono">© {new Date().getFullYear()} Karan Prajapat</span>
      </div>

      <div className="vignette-fade" ref={fade} aria-hidden="true" />
    </>
  );
}
