import { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { AdaptiveEvents, PerformanceMonitor, Preload } from '@react-three/drei';
import { CameraRig } from './CameraRig';
import { Lighting } from './Lighting';
import { Space } from './Space';
import { Effects } from './Effects';
import { World } from './World';
import { useQualityContext } from '../hooks/QualityContext';
import { useAspect } from '../hooks/useAspect';
import { journey } from '../state/journey';

/** Reports the first genuinely rendered frames so the loader can step aside. */
function ReadySignal({ onReady }: { onReady: () => void }) {
  const frames = useRef(0);
  useFrame(() => {
    if (frames.current > 2) return;
    frames.current += 1;
    if (frames.current === 3) {
      journey.ready = true;
      onReady();
    }
  });
  return null;
}

export function Experience({ onReady }: { onReady: () => void }) {
  const quality = useQualityContext();
  const { portrait } = useAspect();
  const setDpr = useThree((state) => state.setDpr);
  const [min, max] = quality.dpr;

  return (
    <>
      {/* Sustained frame drops lower the pixel ratio instead of tearing the
          scene apart — the composition survives, the cost does not. */}
      <PerformanceMonitor
        bounds={() => [48, 58]}
        flipflops={3}
        onChange={({ factor }) => setDpr(min + (max - min) * factor)}
        onFallback={() => setDpr(min)}
      />
      <AdaptiveEvents />

      <CameraRig portrait={portrait} />
      <Lighting quality={quality} />
      <Space quality={quality} />

      <World />

      <Effects quality={quality} />
      <Preload all />
      <ReadySignal onReady={onReady} />
    </>
  );
}
