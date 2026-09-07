import { useCallback, useEffect, useState } from 'react';
import { Stage } from './scenes/Stage';
import { Loader } from './components/Loader';
import { Topbar } from './components/Topbar';
import { Navigation } from './components/Navigation';
import { SectionPanels } from './components/SectionPanels';
import { Ambience } from './components/Overlay';
import { ProjectSheet } from './components/ProjectSheet';
import { ResumeSheet } from './components/ResumeSheet';
import { SceneBoundary } from './components/SceneBoundary';
import { useQuality, type Quality } from './hooks/useQuality';
import { journeyHeight, useJourneyDriver } from './hooks/useJourney';
import { useScrollLock } from './hooks/useScrollLock';
import { UIProvider, useUI } from './state/ui';

/** The invisible column that gives the page something to scroll. */
function ScrollTrack() {
  const [height, setHeight] = useState(() => journeyHeight());

  useEffect(() => {
    const measure = () => setHeight(journeyHeight());
    measure();
    window.addEventListener('resize', measure);
    window.addEventListener('orientationchange', measure);
    return () => {
      window.removeEventListener('resize', measure);
      window.removeEventListener('orientationchange', measure);
    };
  }, []);

  return <div className="scroll-track" style={{ height }} aria-hidden="true" />;
}

function Experience({ quality }: { quality: Quality }) {
  const { focus, resumeOpen } = useUI();
  const [fontsReady, setFontsReady] = useState(false);
  const [sceneReady, setSceneReady] = useState(false);
  const [revealed, setRevealed] = useState(false);

  useJourneyDriver(true);
  useScrollLock(focus !== null || resumeOpen);

  // Always start at the hero, even on a reload halfway down the journey.
  useEffect(() => {
    if ('scrollRestoration' in window.history) window.history.scrollRestoration = 'manual';
    window.scrollTo(0, 0);
  }, []);

  // Canvas textures bake type into bitmaps, so the webfonts must land first.
  useEffect(() => {
    let cancelled = false;
    const done = () => !cancelled && setFontsReady(true);
    if (document.fonts?.ready) {
      document.fonts.ready.then(done).catch(done);
      window.setTimeout(done, 2500);
    } else {
      done();
    }
    return () => {
      cancelled = true;
    };
  }, []);

  // Never trap a visitor behind a loading screen.
  useEffect(() => {
    const timer = window.setTimeout(() => setSceneReady(true), 14000);
    return () => window.clearTimeout(timer);
  }, []);

  const onReady = useCallback(() => setSceneReady(true), []);

  return (
    <>
      <ScrollTrack />
      {fontsReady && (
        <SceneBoundary onFail={onReady}>
          <Stage quality={quality} onReady={onReady} />
        </SceneBoundary>
      )}

      <div className="overlay">
        <Topbar />
      </div>
      <Navigation />
      <SectionPanels />
      <Ambience />

      <ProjectSheet />
      <ResumeSheet />

      {quality.grain && <div className="grain" aria-hidden="true" />}

      {!revealed && (
        <Loader fontsReady={fontsReady} sceneReady={sceneReady} onDone={() => setRevealed(true)} />
      )}
    </>
  );
}

export default function App() {
  const quality = useQuality();
  return (
    <UIProvider>
      <Experience quality={quality} />
    </UIProvider>
  );
}
