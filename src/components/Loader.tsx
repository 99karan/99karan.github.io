import { useEffect, useRef, useState } from 'react';
import { useProgress } from '@react-three/drei';
import { profile } from '../data/portfolio';
import { clamp, damp } from '../animations/easing';

const MIN_VISIBLE_MS = 1100;
const HOLD_MS = 620;

interface LoaderProps {
  fontsReady: boolean;
  sceneReady: boolean;
  onDone: () => void;
}

/**
 * Honest progress: webfonts (every canvas texture bakes type), then the WebGL
 * context and its first frames, then any GLB/texture Drei is tracking. The bar
 * eases towards that number so it reads as a system booting, not a fake timer.
 */
export function Loader({ fontsReady, sceneReady, onDone }: LoaderProps) {
  const { progress: assetProgress, active } = useProgress();
  const [display, setDisplay] = useState(0);
  const [done, setDone] = useState(false);
  const mounted = useRef(performance.now());

  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    let value = 0;

    const tick = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.1);
      last = now;

      const elapsed = now - mounted.current;
      const target =
        (fontsReady ? 34 : 10) +
        (sceneReady ? 40 : 0) +
        (active ? assetProgress * 0.16 : 16) +
        clamp(elapsed / MIN_VISIBLE_MS) * 10;

      value = damp(value, clamp(target, 0, 100), 3.4, dt);
      setDisplay(Math.min(100, Math.round(value)));

      if (value > 99 && fontsReady && sceneReady && elapsed > MIN_VISIBLE_MS) {
        setDisplay(100);
        setDone(true);
        return;
      }
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [fontsReady, sceneReady, active, assetProgress]);

  useEffect(() => {
    if (!done) return;
    const timer = window.setTimeout(onDone, HOLD_MS + 400);
    return () => window.clearTimeout(timer);
  }, [done, onDone]);

  return (
    <div className="loader" data-done={done} role="status" aria-live="polite">
      <div className="loader__inner">
        <div className="loader__name" aria-label={profile.name}>
          {[...profile.name].map((char, i) => (
            <span key={`${char}-${i}`} style={{ animationDelay: `${i * 0.032}s` }} aria-hidden="true">
              {char === ' ' ? ' ' : char}
            </span>
          ))}
        </div>

        <div className="loader__status">
          <span className="mono">Initializing digital space…</span>
          <span className="mono" style={{ color: 'var(--accent)' }}>
            {String(display).padStart(3, '0')}%
          </span>
        </div>

        <div className="loader__bar">
          <i style={{ width: `${display}%` }} />
        </div>

        <div className="loader__meta mono">
          <span>{profile.role}</span>
          <span>
            {display < 40 ? 'Loading typefaces' : display < 80 ? 'Building workspace' : 'Compiling shaders'}
          </span>
        </div>
      </div>
    </div>
  );
}
