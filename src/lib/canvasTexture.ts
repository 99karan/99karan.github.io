import { useEffect, useMemo } from 'react';
import * as THREE from 'three';

export type Draw = (ctx: CanvasRenderingContext2D, width: number, height: number) => void;

export function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  if (typeof ctx.roundRect === 'function') {
    ctx.roundRect(x, y, w, h, radius);
    return;
  }
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

export function tracked(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  spacing: number,
  align: 'left' | 'center' = 'left',
) {
  const chars = [...text];
  const width = chars.reduce((sum, c) => sum + ctx.measureText(c).width + spacing, 0) - spacing;
  let cursor = align === 'center' ? x - width / 2 : x;
  const prev = ctx.textAlign;
  ctx.textAlign = 'left';
  for (const c of chars) {
    ctx.fillText(c, cursor, y);
    cursor += ctx.measureText(c).width + spacing;
  }
  ctx.textAlign = prev;
  return width;
}

/** Creates a canvas-backed texture. Callers own disposal. */
export function createCanvasTexture(width: number, height: number, draw: Draw): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(2, Math.round(width));
  canvas.height = Math.max(2, Math.round(height));
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.textBaseline = 'alphabetic';
    draw(ctx, canvas.width, canvas.height);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

/** Memoised canvas texture that disposes itself with the component. */
export function useCanvasTexture(width: number, height: number, draw: Draw, deps: unknown[] = []) {
  const texture = useMemo(
    () => createCanvasTexture(width, height, draw),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [width, height, ...deps],
  );

  useEffect(() => () => texture.dispose(), [texture]);
  return texture;
}

/** Soft radial dot used for particle sprites. */
export function createDotTexture(size = 64) {
  return createCanvasTexture(size, size, (ctx, w, h) => {
    const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.35, 'rgba(255,255,255,0.55)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  });
}
