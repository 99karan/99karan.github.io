import { Suspense, useCallback } from 'react';
import { Canvas } from '@react-three/fiber';
import { useContextBridge } from '@react-three/drei';
import * as THREE from 'three';
import { Experience } from './Experience';
import { CAMERA_KEYS } from './layout';
import { QualityProvider } from '../hooks/QualityContext';
import { UIContext } from '../state/ui';
import type { Quality } from '../hooks/useQuality';

/**
 * Owns the WebGL canvas. Renderer flags are decided once from the device tier —
 * changing them later would mean rebuilding the context.
 */
export function Stage({ quality, onReady }: { quality: Quality; onReady: () => void }) {
  const ContextBridge = useContextBridge(UIContext);

  const onCreated = useCallback(({ gl }: { gl: THREE.WebGLRenderer }) => {
    gl.toneMapping = THREE.ACESFilmicToneMapping;
    gl.toneMappingExposure = 1.05;
    gl.setClearColor('#04060a', 1);
  }, []);

  return (
    <div className="stage">
      <Canvas
        dpr={quality.dpr}
        shadows={quality.shadows}
        frameloop="always"
        camera={{ fov: 42, near: 0.1, far: 280, position: CAMERA_KEYS.hero.position }}
        gl={{
          antialias: quality.tier === 'high',
          alpha: false,
          stencil: false,
          depth: true,
          powerPreference: 'high-performance',
          preserveDrawingBuffer: false,
        }}
        onCreated={onCreated}
      >
        <ContextBridge>
          <QualityProvider value={quality}>
            <Suspense fallback={null}>
              <Experience onReady={onReady} />
            </Suspense>
          </QualityProvider>
        </ContextBridge>
      </Canvas>
    </div>
  );
}
