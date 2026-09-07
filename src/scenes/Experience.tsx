import { useRef, useState } from 'react';
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
  const [dof, setDof] = useState(quality.dof);

  return (
    <>
      {/* When the GPU struggles, spend the budget on resolution, not on
          effects: a lowered pixel ratio is visible on every glyph, while the
          missing depth of field is not. So the effect goes first, and only a
          hard fallback touches the pixel ratio. */}
      <PerformanceMonitor
        bounds={(refreshRate) => (refreshRate > 90 ? [50, 90] : [46, 58])}
        flipflops={3}
        onIncline={() => setDpr(max)}
        onDecline={() => (dof ? setDof(false) : setDpr(Math.max(min, max * 0.85)))}
        onFallback={() => {
          setDof(false);
          setDpr(min);
        }}
      />
      <AdaptiveEvents />

      <CameraRig portrait={portrait} />
      <Lighting quality={quality} />
      <Space quality={quality} />

      <World />

      <Effects quality={quality} dof={dof} />
      <Preload all />
      <ReadySignal onReady={onReady} />
    </>
  );
}
