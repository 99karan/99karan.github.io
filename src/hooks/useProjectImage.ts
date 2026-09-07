import { useEffect, useState } from 'react';
import * as THREE from 'three';

/**
 * Uses a real screenshot when one exists in /public/projects, otherwise keeps
 * the generated mock. Loading is optional and lazy, so a missing file degrades
 * to a nice-looking placeholder instead of a suspended (blank) scene.
 */
export function useProjectImage(url: string | undefined, fallback: THREE.Texture) {
  const [texture, setTexture] = useState<THREE.Texture>(fallback);

  useEffect(() => {
    if (!url) {
      setTexture(fallback);
      return;
    }
    let cancelled = false;
    const loader = new THREE.TextureLoader();
    let loaded: THREE.Texture | null = null;

    loader.load(
      url,
      (result) => {
        if (cancelled) {
          result.dispose();
          return;
        }
        result.colorSpace = THREE.SRGBColorSpace;
        result.anisotropy = 4;
        loaded = result;
        setTexture(result);
      },
      undefined,
      () => {
        if (!cancelled) setTexture(fallback);
      },
    );

    return () => {
      cancelled = true;
      loaded?.dispose();
    };
  }, [url, fallback]);

  return texture;
}
