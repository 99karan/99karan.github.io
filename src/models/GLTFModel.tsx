import { useEffect } from 'react';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';

interface GLTFModelProps {
  /** Path relative to /public, e.g. "./models/desk.glb". */
  url: string;
  position?: [number, number, number];
  rotation?: [number, number, number];
  scale?: number | [number, number, number];
  castShadow?: boolean;
  receiveShadow?: boolean;
}

/**
 * Drop-in slot for real GLB/GLTF assets.
 *
 *   <GLTFModel url="./models/workstation.glb" scale={0.5} castShadow />
 *
 * Render it inside the <Suspense> that already wraps the scene, and call
 * `useGLTF.preload('./models/workstation.glb')` at module scope if you want it
 * fetched during the loading screen. Use Draco/Meshopt-compressed files.
 */
export function GLTFModel({
  url,
  position,
  rotation,
  scale = 1,
  castShadow = true,
  receiveShadow = true,
}: GLTFModelProps) {
  const { scene } = useGLTF(url);

  useEffect(() => {
    scene.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = castShadow;
      mesh.receiveShadow = receiveShadow;
      mesh.frustumCulled = true;
    });
  }, [scene, castShadow, receiveShadow]);

  return <primitive object={scene} position={position} rotation={rotation} scale={scale} />;
}
