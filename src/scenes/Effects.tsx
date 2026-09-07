import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Bloom, DepthOfField, EffectComposer, Vignette } from '@react-three/postprocessing';
import { BlendFunction, KernelSize, type DepthOfFieldEffect } from 'postprocessing';
import * as THREE from 'three';
import { focusPoint } from './focus';
import type { Quality } from '../hooks/useQuality';

/**
 * Post pipeline, tier-gated.
 *
 * Two rules keep this sharp rather than smeared:
 *
 * 1. Depth of field tracks what the camera is actually looking at. A fixed
 *    focus distance puts the subject behind the focal plane for most of the
 *    journey, which reads as a blurry render, not as depth.
 * 2. Bloom sits well above the mid-tones. Lower thresholds bloom body text
 *    into itself, and no amount of resolution recovers that.
 *
 * Multisampling is deliberately off: at the pixel ratios this runs at, it costs
 * more than it returns, and that budget is better spent on the pixel ratio.
 */
export function Effects({ quality, dof: dofEnabled }: { quality: Quality; dof: boolean }) {
  const dof = useRef<DepthOfFieldEffect>(null);
  // Stable instance: a fresh Vector3 each render would reset the focus point.
  const focusTarget = useMemo(() => new THREE.Vector3(), []);

  useFrame(() => {
    const target = dof.current?.target;
    if (target) target.copy(focusPoint);
  });

  if (quality.tier === 'low') {
    return (
      <EffectComposer multisampling={0} enableNormalPass={false}>
        <Bloom
          intensity={quality.bloomIntensity}
          luminanceThreshold={0.74}
          luminanceSmoothing={0.22}
          kernelSize={KernelSize.MEDIUM}
          mipmapBlur
        />
        <Vignette offset={0.28} darkness={0.72} blendFunction={BlendFunction.NORMAL} />
      </EffectComposer>
    );
  }

  return (
    <EffectComposer multisampling={0} enableNormalPass={false}>
      <Bloom
        intensity={quality.bloomIntensity}
        luminanceThreshold={0.72}
        luminanceSmoothing={0.2}
        kernelSize={KernelSize.LARGE}
        mipmapBlur
      />
      {quality.dof && dofEnabled ? (
        <DepthOfField
          ref={dof}
          // A non-null target switches the effect into auto-focus mode; the
          // vector is refreshed from the camera rig every frame.
          target={focusTarget}
          worldFocusRange={9}
          bokehScale={1.6}
          resolutionScale={0.85}
        />
      ) : (
        <></>
      )}
      <Vignette offset={0.24} darkness={0.76} blendFunction={BlendFunction.NORMAL} />
    </EffectComposer>
  );
}
