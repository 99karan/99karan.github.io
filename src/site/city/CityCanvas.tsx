import { Canvas } from '@react-three/fiber';
import { Suspense } from 'react';
import { CityScene, type CitySceneProps } from './CityScene';

/** The WebGL half of the Repo City, split into its own chunk so the page never waits on three.js. */
export default function CityCanvas({ visible, onMiss, ...scene }: CitySceneProps & { visible: boolean; onMiss: () => void }) {
  return (
    <Canvas
      className="city__canvas"
      dpr={[1, scene.high ? 1.75 : 1.4]}
      frameloop={visible ? 'always' : 'never'}
      camera={{ fov: 32, near: 0.5, far: 400, position: [30, 26, 36] }}
      gl={{ antialias: !scene.high, powerPreference: 'high-performance' }}
      onPointerMissed={onMiss}
    >
      <Suspense fallback={null}>
        <CityScene {...scene} />
      </Suspense>
    </Canvas>
  );
}
