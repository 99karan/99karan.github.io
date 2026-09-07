import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Bloom, DepthOfField, EffectComposer, Noise, Vignette } from '@react-three/postprocessing';
import { BlendFunction, KernelSize, type DepthOfFieldEffect } from 'postprocessing';
import * as THREE from 'three';
import { focusPoint } from './focus';
import type { Quality } from '../hooks/useQuality';

/**
 * Post pipeline, tier-gated.
 *
 * Two things here decide whether the site looks crisp or smeared:
 * depth of field must track what the camera is actually looking at, and bloom
 * must sit high enough above the mid-tones that it lifts emissive edges
 * instead of blooming every line of text.
 */
export function Effects({ quality }: { quality: Quality }) {
  const dof = useRef<DepthOfFieldEffect>(null);

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
    <EffectComposer multisampling={quality.tier === 'high' ? 4 : 0} enableNormalPass={false}>
      <Bloom
        intensity={quality.bloomIntensity}
        luminanceThreshold={0.72}
        luminanceSmoothing={0.2}
        kernelSize={KernelSize.LARGE}
        mipmapBlur
      />
      {quality.dof ? (
        <DepthOfField
          ref={dof}
          // A non-null target switches the effect into auto-focus mode; the
          // vector itself is refreshed every frame from the camera rig.
          target={new THREE.Vector3()}
          worldFocusRange={7}
          bokehScale={1.9}
          resolutionScale={1}
        />
      ) : (
        <></>
      )}
      <Vignette offset={0.24} darkness={0.76} blendFunction={BlendFunction.NORMAL} />
      {quality.grain ? <Noise opacity={0.022} premultiply blendFunction={BlendFunction.SCREEN} /> : <></>}
    </EffectComposer>
  );
}
