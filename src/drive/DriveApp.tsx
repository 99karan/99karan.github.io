import { useCallback, useEffect, useState } from 'react';
import { Loader } from '../components/Loader';
import { ProjectSheet } from '../components/ProjectSheet';
import { ResumeSheet } from '../components/ResumeSheet';
import { SceneBoundary } from '../components/SceneBoundary';
import { useQuality } from '../hooks/useQuality';
import { UIProvider, useUI } from '../state/ui';
import { sound } from './audio';
import { DriveStage } from './DriveStage';
import { Hud } from './hud/Hud';
import { DrivePanels } from './hud/Panels';
import { installKeyboard, onAction } from './input';
import { runtime, store, useStore } from './state';
import { zones } from './world/placements';
import { profile } from '../data/portfolio';
import '../styles/index.css';
import './drive.css';

function Island() {
  const quality = useQuality();
  const { focus, setFocus, resumeOpen, setResumeOpen } = useUI();
  const panel = useStore((s) => s.panel);
  const started = useStore((s) => s.started);
  const muted = useStore((s) => s.muted);
  const [fontsReady, setFontsReady] = useState(false);
  const [sceneReady, setSceneReady] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => installKeyboard(), []);

  // Test hook for automated screenshots (dev builds only).
  useEffect(() => {
    if (import.meta.env.DEV) (window as unknown as { __drive: unknown }).__drive = { runtime, store };
  }, []);

  // Canvas textures bake type, so the webfonts must land first.
  useEffect(() => {
    let cancelled = false;
    const done = () => !cancelled && setFontsReady(true);
    if (document.fonts?.ready) {
      document.fonts.ready.then(done).catch(done);
      window.setTimeout(done, 2500);
    } else done();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const t = window.setTimeout(() => setSceneReady(true), 16000);
    return () => window.clearTimeout(t);
  }, []);

  useEffect(() => sound.setMuted(muted), [muted]);

  // Freeze the vehicle while reading.
  useEffect(() => {
    runtime.frozen = !started || focus !== null || resumeOpen || panel !== null;
  }, [started, focus, resumeOpen, panel]);

  // "E" opens whatever you're parked at.
  useEffect(
    () =>
      onAction((action) => {
        if (action !== 'interact') return;
        const zone = zones.find((z) => z.id === store.get().zone);
        if (!zone) return;
        if (zone.kind === 'project' && zone.ref) setFocus(zone.ref);
        else if (zone.kind === 'resume') setResumeOpen(true);
        else if (zone.kind === 'about' || zone.kind === 'skills' || zone.kind === 'contact') store.set({ panel: zone.kind });
      }),
    [setFocus, setResumeOpen],
  );

  useEffect(() => {
    if (panel === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') store.set({ panel: null });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [panel]);

  const onReady = useCallback(() => setSceneReady(true), []);

  return (
    <>
      {failed && (
        <div className="no-webgl">
          <div className="intro__card">
            <h1>{profile.name}</h1>
            <p>Your browser couldn&rsquo;t start the 3D island (WebGL is unavailable). Everything is still here:</p>
            <div className="intro__actions" style={{ justifyContent: 'center', marginTop: '1rem' }}>
              <a className="btn btn--primary" href="./">
                <span className="btn__dot" aria-hidden="true" />
                Open the main site
              </a>
              <a className="btn" href="./resume.html">
                Read the resume
              </a>
            </div>
          </div>
        </div>
      )}
      {fontsReady && !failed && (
        <SceneBoundary
          onFail={() => {
            setFailed(true);
            onReady();
          }}
        >
          <DriveStage quality={quality} onReady={onReady} />
        </SceneBoundary>
      )}
      <Hud touchUI={quality.isTouch} />
      <DrivePanels />
      <ProjectSheet />
      <ResumeSheet />
      {!revealed && <Loader fontsReady={fontsReady} sceneReady={sceneReady} onDone={() => setRevealed(true)} />}
    </>
  );
}

export default function DriveApp() {
  return (
    <UIProvider>
      <Island />
    </UIProvider>
  );
}
