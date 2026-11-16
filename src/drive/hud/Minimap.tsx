import { useEffect, useRef } from 'react';
import { MARINA, ROADS, RUNWAY, terrainAt } from '../world/map';
import { tokens, zones } from '../world/placements';
import { runtime, store } from '../state';

/**
 * North-up island map. The landscape is painted once into an offscreen
 * canvas; each tick only the markers and the player arrow are redrawn.
 */

const SPAN = 560; // metres across
const RES = 200; // base image pixels

function paintBase() {
  const c = document.createElement('canvas');
  c.width = c.height = RES;
  const ctx = c.getContext('2d')!;
  const img = ctx.createImageData(RES, RES);
  for (let j = 0; j < RES; j++) {
    for (let i = 0; i < RES; i++) {
      const x = (i / RES - 0.5) * SPAN;
      const z = (j / RES - 0.5) * SPAN;
      const h = terrainAt(x, z);
      let r: number, g: number, b: number;
      if (h < -0.3) {
        const d = Math.min(1, -h / 9);
        r = 40 - d * 25;
        g = 150 - d * 80;
        b = 170 - d * 50;
      } else if (h < 1.4) {
        [r, g, b] = [214, 196, 150];
      } else if (h > 30) {
        [r, g, b] = [128, 124, 116];
      } else {
        const k = Math.min(1, h / 30);
        r = 82 + k * 30;
        g = 130 - k * 10;
        b = 64 + k * 20;
      }
      const o = (j * RES + i) * 4;
      img.data[o] = r;
      img.data[o + 1] = g;
      img.data[o + 2] = b;
      img.data[o + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const s = RES / SPAN;
  const px = (v: number) => (v / SPAN + 0.5) * RES;
  ctx.strokeStyle = 'rgba(40,42,48,0.9)';
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const road of ROADS) {
    ctx.lineWidth = road.width * s;
    ctx.beginPath();
    road.points.forEach(([x, z], i) => (i ? ctx.lineTo(px(x), px(z)) : ctx.moveTo(px(x), px(z))));
    if (road.closed) ctx.closePath();
    ctx.stroke();
  }
  ctx.fillStyle = 'rgba(40,42,48,0.95)';
  ctx.fillRect(px(RUNWAY.x - RUNWAY.halfW), px(RUNWAY.z - RUNWAY.halfL), RUNWAY.halfW * 2 * s, RUNWAY.halfL * 2 * s);
  ctx.strokeStyle = '#8a6440';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(px(MARINA.start.x), px(MARINA.start.z));
  ctx.lineTo(px(MARINA.end.x), px(MARINA.end.z));
  ctx.stroke();
  return c;
}

export function Minimap() {
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const base = paintBase();
    const el = canvas.current;
    if (!el) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const size = el.clientWidth || 168;
    el.width = size * dpr;
    el.height = size * dpr;
    const ctx = el.getContext('2d')!;
    let raf = 0;
    let last = 0;

    const draw = (now: number) => {
      raf = requestAnimationFrame(draw);
      if (now - last < 66) return;
      last = now;
      const W = el.width;
      const px = (v: number) => (v / SPAN + 0.5) * W;
      ctx.clearRect(0, 0, W, W);
      ctx.save();
      ctx.beginPath();
      ctx.arc(W / 2, W / 2, W / 2, 0, Math.PI * 2);
      ctx.clip();
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(base, 0, 0, W, W);

      // zones
      for (const z of zones) {
        if (z.kind === 'milestone') continue;
        ctx.fillStyle = '#66e0c0';
        ctx.beginPath();
        ctx.arc(px(z.x), px(z.z), 3 * dpr, 0, Math.PI * 2);
        ctx.fill();
      }
      // remaining skills
      const got = store.get().collected;
      const pulse = 0.6 + Math.sin(now / 250) * 0.4;
      for (const t of tokens) {
        if (got.includes(t.skill)) continue;
        ctx.fillStyle = `rgba(255, 210, 90, ${pulse})`;
        ctx.beginPath();
        ctx.arc(px(t.x), px(t.z), 2.4 * dpr, 0, Math.PI * 2);
        ctx.fill();
      }

      // player
      const p = runtime.position;
      const a = Math.atan2(runtime.heading.x, runtime.heading.z);
      ctx.translate(px(p.x), px(p.z));
      ctx.rotate(-a);
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#05070b';
      ctx.lineWidth = 1.5 * dpr;
      ctx.beginPath();
      ctx.moveTo(0, 7 * dpr);
      ctx.lineTo(5 * dpr, -5 * dpr);
      ctx.lineTo(0, -2.5 * dpr);
      ctx.lineTo(-5 * dpr, -5 * dpr);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();

      ctx.strokeStyle = 'rgba(255,255,255,0.25)';
      ctx.lineWidth = 1.5 * dpr;
      ctx.beginPath();
      ctx.arc(W / 2, W / 2, W / 2 - dpr, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.font = `600 ${10 * dpr}px "JetBrains Mono", monospace`;
      ctx.textAlign = 'center';
      ctx.fillText('N', W / 2, 13 * dpr);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, []);

  return <canvas ref={canvas} className="minimap" aria-label="Island map" role="img" />;
}
