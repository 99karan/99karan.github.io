import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Grid } from '@react-three/drei';
import * as THREE from 'three';
import { createDotTexture } from '../lib/canvasTexture';
import type { Quality } from '../hooks/useQuality';

/** Backdrop gradient — cheaper and cleaner than a skybox texture. */
function Backdrop() {
  const uniforms = useMemo(
    () => ({
      uTop: { value: new THREE.Color('#0a1018') },
      uBottom: { value: new THREE.Color('#03050a') },
      uGlow: { value: new THREE.Color('#0d2a2a') },
    }),
    [],
  );

  return (
    <mesh scale={[1, 1, 1]} frustumCulled={false} renderOrder={-100}>
      <sphereGeometry args={[240, 24, 16]} />
      <shaderMaterial
        side={THREE.BackSide}
        depthWrite={false}
        uniforms={uniforms}
        vertexShader={/* glsl */ `
          varying vec3 vPos;
          void main() {
            vPos = position;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `}
        fragmentShader={/* glsl */ `
          uniform vec3 uTop; uniform vec3 uBottom; uniform vec3 uGlow;
          varying vec3 vPos;
          void main() {
            vec3 dir = normalize(vPos);
            float h = smoothstep(-0.35, 0.55, dir.y);
            vec3 col = mix(uBottom, uTop, h);
            float glow = pow(max(0.0, 1.0 - abs(dir.y) * 2.4), 3.0) * smoothstep(0.0, -1.0, dir.z);
            col += uGlow * glow * 0.55;
            gl_FragColor = vec4(col, 1.0);
          }
        `}
      />
    </mesh>
  );
}

/** Slow ambient dust spanning the whole corridor the camera travels down. */
function Dust({ count }: { count: number }) {
  const points = useRef<THREE.Points>(null);
  const sprite = useMemo(() => createDotTexture(64), []);

  const geometry = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const scales = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 78;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 40 + 2;
      positions[i * 3 + 2] = 16 - Math.random() * 128;
      scales[i] = 0.35 + Math.random() * 0.9;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('aScale', new THREE.BufferAttribute(scales, 1));
    return geo;
  }, [count]);

  useEffect(() => {
    return () => {
      geometry.dispose();
      sprite.dispose();
    };
  }, [geometry, sprite]);

  useFrame((state) => {
    if (!points.current) return;
    const t = state.clock.elapsedTime;
    points.current.rotation.y = t * 0.006;
    points.current.position.y = Math.sin(t * 0.12) * 0.4;
  });

  return (
    <points ref={points} geometry={geometry} frustumCulled={false}>
      <pointsMaterial
        size={0.085}
        map={sprite}
        transparent
        opacity={0.5}
        depthWrite={false}
        sizeAttenuation
        blending={THREE.AdditiveBlending}
        color="#9fd8ff"
      />
    </points>
  );
}

export function Space({ quality }: { quality: Quality }) {
  return (
    <>
      <fogExp2 attach="fog" args={['#04060a', 0.0135]} />
      <Backdrop />
      <Dust count={quality.particles} />
      {quality.grid && (
        <Grid
          position={[0, -1.55, -40]}
          args={[160, 190]}
          cellSize={0.9}
          cellThickness={0.5}
          cellColor="#132030"
          sectionSize={5.4}
          sectionThickness={0.9}
          sectionColor="#1d3d44"
          fadeDistance={46}
          fadeStrength={1.6}
          followCamera={false}
          infiniteGrid={false}
        />
      )}
    </>
  );
}
