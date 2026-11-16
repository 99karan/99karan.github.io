import { Suspense, useEffect, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { useContextBridge } from '@react-three/drei';
import { Bloom, EffectComposer, ToneMapping, Vignette } from '@react-three/postprocessing';
import { ToneMappingMode } from 'postprocessing';
import * as THREE from 'three';
import type { Quality } from '../hooks/useQuality';
import { UIContext } from '../state/ui';
import { CameraRig } from './CameraRig';
import { Player } from './Player';
import { useStore } from './state';
import { Marks, Particles } from './vehicles/Effects';
import { Atmosphere } from './world/Atmosphere';
import { Collectibles } from './world/Collectibles';
import { Dock, Helipads, Plaza, Ramps, Roads, Runway } from './world/Infrastructure';
import { PhysicsProps } from './world/Knockables';
import { Clouds, SkyDome, Terrain, Water } from './world/Landscape';
import {
  AboutPavilion,
  Airfield,
  CareerGates,
  Forest,
  Lighthouse,
  ProjectGallery,
  ResumeHQ,
  Rocks,
  SkillGarden,
  StreetLamps,
  Village,
  ZoneMarkers,
} from './world/Landmarks';

/** Calls onReady after the first frames have actually been drawn. */
function Ready({ onReady }: { onReady: () => void }) {
  const frames = useRef(0);
  const done = useRef(false);
  useFrame(() => {
    if (done.current) return;
    if (++frames.current > 3) {
      done.current = true;
      onReady();
    }
  });
  return null;
}

function World({ quality }: { quality: Quality }) {
  const vehicle = useStore((s) => s.vehicle);
  const tier = quality.tier;
  const debugPhysics = typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('physics');
  return (
    <>
      <Atmosphere shadows={quality.shadows} shadowSize={tier === 'high' ? 2048 : 1024} />
      <SkyDome />
      <Terrain segments={tier === 'high' ? 300 : tier === 'mid' ? 220 : 150} />
      <Water segments={tier === 'low' ? 120 : 220} />
      <Roads />
      <Runway />
      <Plaza />
      <Ramps />
      <Dock />
      <Helipads />

      <AboutPavilion />
      <ResumeHQ />
      <SkillGarden />
      <ProjectGallery />
      <CareerGates />
      <Lighthouse />
      <Airfield />
      <Village />
      <StreetLamps />
      <Forest count={tier === 'high' ? 620 : tier === 'mid' ? 420 : 240} shadows={quality.shadows && tier === 'high'} />
      <Rocks count={tier === 'low' ? 60 : 140} />
      <ZoneMarkers />
      <Clouds count={tier === 'low' ? 8 : 16} />

      <PhysicsProps vehicle={vehicle} debug={debugPhysics} />
      <Collectibles />
      <Player />
      <Particles />
      <Marks />
      <CameraRig />
    </>
  );
}

function PostFX({ quality }: { quality: Quality }) {
  if (quality.tier === 'low') return null;
  return (
    <EffectComposer multisampling={quality.tier === 'high' ? 4 : 0} enableNormalPass={false}>
      <Bloom intensity={0.45} luminanceThreshold={1.05} luminanceSmoothing={0.3} mipmapBlur />
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
      <Vignette offset={0.32} darkness={0.55} />
    </EffectComposer>
  );
}

export function DriveStage({ quality, onReady }: { quality: Quality; onReady: () => void }) {
  const ContextBridge = useContextBridge(UIContext);

  useEffect(() => {
    document.body.classList.add('is-driving');
    return () => document.body.classList.remove('is-driving');
  }, []);

  return (
    <div className="drive-stage">
      <Canvas
        dpr={quality.tier === 'high' ? [1, 1.75] : quality.tier === 'mid' ? [1, 1.5] : [0.8, 1.25]}
        shadows={quality.shadows ? 'soft' : false}
        camera={{ fov: 55, near: 0.3, far: 2400, position: [0, 12, 40] }}
        gl={{ antialias: quality.tier === 'low', powerPreference: 'high-performance', stencil: false }}
        onCreated={({ gl }) => {
          gl.toneMapping = quality.tier === 'low' ? THREE.ACESFilmicToneMapping : THREE.NoToneMapping;
          gl.toneMappingExposure = 1;
        }}
      >
        <ContextBridge>
          <Suspense fallback={null}>
            <World quality={quality} />
            <PostFX quality={quality} />
            <Ready onReady={onReady} />
          </Suspense>
        </ContextBridge>
      </Canvas>
    </div>
  );
}
