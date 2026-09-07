import { EffectComposer, Bloom, DepthOfField, N8AO, Noise, Vignette } from '@react-three/postprocessing';
import { BlendFunction, KernelSize } from 'postprocessing';
import type { Quality } from '../hooks/useQuality';

/**
 * Post pipeline, tier-gated. Bloom is the only effect every device gets, and it
 * runs with a high luminance threshold so it lifts screens and emissive edges
 * rather than washing the whole frame.
 */
export function Effects({ quality }: { quality: Quality }) {
  if (quality.tier === 'low') {
    return (
      <EffectComposer multisampling={0} enableNormalPass={false}>
        <Bloom
          intensity={quality.bloomIntensity}
          luminanceThreshold={0.62}
          luminanceSmoothing={0.3}
          kernelSize={KernelSize.MEDIUM}
          mipmapBlur
        />
        <Vignette offset={0.28} darkness={0.72} blendFunction={BlendFunction.NORMAL} />
      </EffectComposer>
    );
  }

  return (
    <EffectComposer multisampling={quality.tier === 'high' ? 2 : 0} enableNormalPass={false}>
      {quality.ao ? (
        <N8AO aoRadius={1.4} intensity={1.5} distanceFalloff={0.8} quality="low" halfRes color="#04060a" />
      ) : (
        <></>
      )}
      <Bloom
        intensity={quality.bloomIntensity}
        luminanceThreshold={0.58}
        luminanceSmoothing={0.28}
        kernelSize={KernelSize.LARGE}
        mipmapBlur
      />
      {quality.dof ? (
        <DepthOfField worldFocusDistance={10.4} worldFocusRange={9} bokehScale={2.6} resolutionScale={0.85} />
      ) : (
        <></>
      )}
      <Vignette offset={0.24} darkness={0.78} blendFunction={BlendFunction.NORMAL} />
      {quality.grain ? <Noise opacity={0.028} premultiply blendFunction={BlendFunction.SCREEN} /> : <></>}
    </EffectComposer>
  );
}
