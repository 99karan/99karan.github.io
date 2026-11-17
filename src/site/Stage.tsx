import { useEffect, useRef, useState } from 'react';
import type { Chapter, StageKind } from './content';
import { readInk, reduceMotion, useInView, type Ink } from './hooks';

type Draw = (ctx: CanvasRenderingContext2D, w: number, h: number, t: number, ink: Ink) => void;

const TAU = Math.PI * 2;
const frac = (x: number) => x - Math.floor(x);
const ease = (t: number) => 1 - Math.pow(1 - t, 3);

function brackets(ctx: CanvasRenderingContext2D, w: number, h: number, ink: Ink, inset = 14) {
  const l = 18;
  ctx.strokeStyle = `rgba(${ink.boneRgb},.35)`;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (const [x, y, sx, sy] of [
    [inset, inset, 1, 1],
    [w - inset, inset, -1, 1],
    [inset, h - inset, 1, -1],
    [w - inset, h - inset, -1, -1],
  ]) {
    ctx.moveTo(x, y + sy * l);
    ctx.lineTo(x, y);
    ctx.lineTo(x + sx * l, y);
  }
  ctx.stroke();
}

/* Shot Tracing: a ball flight with a three-layer glowing trail, like the app's painter. */
const trail: Draw = (ctx, w, h, t, ink) => {
  brackets(ctx, w, h, ink);
  const ground = h * 0.86;
  ctx.strokeStyle = `rgba(${ink.boneRgb},.18)`;
  ctx.setLineDash([3, 6]);
  ctx.beginPath();
  ctx.moveTo(0, ground);
  ctx.lineTo(w, ground);
  ctx.stroke();
  ctx.setLineDash([]);

  const cycle = 3.6;
  const k = frac(t / cycle);
  const flight = Math.min(1, k / 0.72);
  const fade = k > 0.82 ? 1 - (k - 0.82) / 0.18 : 1;
  const x0 = w * 0.12;
  const x1 = w * 0.92;
  const apex = h * 0.16;
  const at = (u: number): [number, number] => {
    const x = x0 + (x1 - x0) * u;
    // A golf flight: steep climb, long flat glide, then a drop.
    const y = ground - (ground - apex) * Math.sin(Math.PI * Math.pow(u, 0.82)) * (1 - 0.15 * u);
    return [x, y];
  };
  const head = ease(flight);
  const steps = 60;
  // The app keeps the last 25 points; draw the whole flight, fading the oldest.
  const layers: [number, string][] = [
    [12, `rgba(${ink.signalRgb},${0.08 * fade})`],
    [5, `rgba(${ink.signalRgb},${0.3 * fade})`],
    [1.6, `rgba(255,236,214,${0.95 * fade})`],
  ];
  for (const [lw, color] of layers) {
    ctx.lineWidth = lw;
    ctx.strokeStyle = color;
    ctx.lineCap = 'round';
    ctx.beginPath();
    for (let i = 0; i <= steps; i++) {
      const u = (i / steps) * head;
      const [x, y] = at(u);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  const [bx, by] = at(head);
  ctx.fillStyle = `rgba(255,248,240,${fade})`;
  ctx.beginPath();
  ctx.arc(bx, by, 3.2, 0, TAU);
  ctx.fill();
  // Detection box around the ball.
  ctx.strokeStyle = `rgba(${ink.signalRgb},${0.8 * fade})`;
  ctx.strokeRect(bx - 9, by - 9, 18, 18);
  ctx.font = `500 9px 'Martian Mono', monospace`;
  ctx.fillStyle = `rgba(${ink.signalRgb},${0.9 * fade})`;
  ctx.fillText(`0.${(84 + Math.floor(head * 13)) % 100}`, bx + 12, by - 6);

  // Shot stats overlay.
  ctx.fillStyle = `rgba(${ink.boneRgb},.6)`;
  ctx.fillText(`SHOT 0${1 + (Math.floor(t / cycle) % 9)}`, 24, 34);
  ctx.fillText(`${Math.round(head * 212)} yd`, 24, 50);
};

/* Object Trajectory Tracking: a marble bounces in a video frame; each frame's centre is a point on the path. */
const trajectory: Draw = (ctx, w, h, t, ink) => {
  const pad = w * 0.1;
  const fx = pad;
  const fy = pad;
  const fw = w - pad * 2;
  const fh = h - pad * 2;
  ctx.strokeStyle = `rgba(${ink.boneRgb},.22)`;
  ctx.strokeRect(fx, fy, fw, fh);
  // Film perforations, so the frame reads as video.
  ctx.fillStyle = `rgba(${ink.boneRgb},.14)`;
  for (let x = fx + 8; x < fx + fw - 8; x += 16) {
    ctx.fillRect(x, fy - 9, 8, 4);
    ctx.fillRect(x, fy + fh + 5, 8, 4);
  }

  const cycle = 5;
  const k = frac(t / cycle);
  const sim = (time: number): [number, number] => {
    // Projectile with damped bounces, simulated analytically per bounce.
    let x = 0.06;
    let y = 0.12;
    let vx = 0.2;
    let vy = 0;
    const g = 2.6;
    let left = time;
    for (let b = 0; b < 8 && left > 0; b++) {
      const floor = 0.9;
      // time until floor: y + vy t + g t^2 / 2 = floor
      const a = g / 2;
      const tb = (-vy + Math.sqrt(vy * vy + 4 * a * (floor - y))) / (2 * a);
      const step = Math.min(tb, left);
      x += vx * step;
      y += vy * step + a * step * step;
      vy += g * step;
      left -= step;
      if (left > 0) {
        vy = -vy * 0.68;
        y = floor;
      }
    }
    return [fx + fw * Math.min(0.96, x), fy + fh * y];
  };
  const now = k * cycle * 0.9;
  const fps = 14;
  const n = Math.floor(now * fps);
  ctx.strokeStyle = `rgba(${ink.signalRgb},.85)`;
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  for (let i = 0; i <= n; i++) {
    const [x, y] = sim(i / fps);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
  for (let i = 0; i <= n; i++) {
    const [x, y] = sim(i / fps);
    ctx.fillStyle = `rgba(${ink.boneRgb},${0.25 + 0.6 * (i / Math.max(1, n))})`;
    ctx.fillRect(x - 1.5, y - 1.5, 3, 3);
  }
  const [mx, my] = sim(now);
  ctx.fillStyle = '#0b0b0d';
  ctx.strokeStyle = `rgba(${ink.boneRgb},.8)`;
  ctx.beginPath();
  ctx.arc(mx, my, 7, 0, TAU);
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = `rgba(${ink.signalRgb},.9)`;
  ctx.beginPath();
  ctx.moveTo(mx - 13, my);
  ctx.lineTo(mx + 13, my);
  ctx.moveTo(mx, my - 13);
  ctx.lineTo(mx, my + 13);
  ctx.stroke();
  ctx.font = `500 9px 'Martian Mono', monospace`;
  ctx.fillStyle = `rgba(${ink.boneRgb},.6)`;
  ctx.fillText(`f ${String(n).padStart(3, '0')}  x ${Math.round(mx - fx)}  y ${Math.round(my - fy)}`, fx + 8, fy + 16);
};

/* LAN API Tool: devices discover each other (mDNS rings) and sync requests over sockets. */
const lan: Draw = (ctx, w, h, t, ink) => {
  const nodes: [number, number, string][] = [
    [0.22, 0.32, 'GET'],
    [0.78, 0.26, 'POST'],
    [0.8, 0.72, 'PUT'],
    [0.26, 0.74, 'DEL'],
  ];
  const pts = nodes.map(([u, v, m]) => [u * w, v * h, m] as [number, number, string]);
  // Links.
  ctx.strokeStyle = `rgba(${ink.boneRgb},.14)`;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = 0; i < pts.length; i++) {
    for (let j = i + 1; j < pts.length; j++) {
      ctx.moveTo(pts[i][0], pts[i][1]);
      ctx.lineTo(pts[j][0], pts[j][1]);
    }
  }
  ctx.stroke();
  // Discovery pulses.
  pts.forEach(([x, y], i) => {
    const k = frac(t / 2.4 + i * 0.25);
    ctx.strokeStyle = `rgba(${ink.boneRgb},${0.35 * (1 - k)})`;
    ctx.beginPath();
    ctx.arc(x, y, 10 + k * 46, 0, TAU);
    ctx.stroke();
  });
  // Packets: a request goes from one device to every other.
  const sender = Math.floor(t / 1.4) % pts.length;
  const k = ease(frac(t / 1.4));
  pts.forEach(([x, y], j) => {
    if (j === sender) return;
    const [sx, sy] = pts[sender];
    const px = sx + (x - sx) * k;
    const py = sy + (y - sy) * k;
    ctx.fillStyle = `rgba(${ink.signalRgb},${1 - k * 0.3})`;
    ctx.fillRect(px - 3, py - 3, 6, 6);
  });
  // Devices.
  ctx.font = `500 9px 'Martian Mono', monospace`;
  pts.forEach(([x, y, m], i) => {
    const hot = i === sender;
    ctx.fillStyle = readGround(ink);
    ctx.strokeStyle = hot ? ink.signal : `rgba(${ink.boneRgb},.6)`;
    ctx.lineWidth = 1.2;
    ctx.fillRect(x - 22, y - 14, 44, 28);
    ctx.strokeRect(x - 22, y - 14, 44, 28);
    ctx.beginPath();
    ctx.moveTo(x - 28, y + 18);
    ctx.lineTo(x + 28, y + 18);
    ctx.stroke();
    ctx.fillStyle = hot ? ink.signal : `rgba(${ink.boneRgb},.75)`;
    ctx.textAlign = 'center';
    ctx.fillText(m, x, y + 3);
    ctx.textAlign = 'left';
  });
};

function readGround(ink: Ink) {
  return ink.ground || '#06090b';
}

/* Ludo Multiplayer: a cross-shaped track, four homes, tokens hopping with the dice. */
const ludo: Draw = (ctx, w, h, t, ink) => {
  const n = 15;
  const size = Math.min(w, h) * 0.84;
  const c = size / n;
  const ox = (w - size) / 2;
  const oy = (h - size) / 2;
  const homes = [`rgba(${ink.signalRgb},.55)`, `rgba(${ink.boneRgb},.4)`, `rgba(${ink.boneRgb},.22)`, `rgba(${ink.boneRgb},.12)`];
  // Homes.
  [
    [0, 0],
    [9, 0],
    [9, 9],
    [0, 9],
  ].forEach(([gx, gy], i) => {
    ctx.strokeStyle = homes[i];
    ctx.lineWidth = 1.2;
    ctx.strokeRect(ox + gx * c + 3, oy + gy * c + 3, c * 6 - 6, c * 6 - 6);
  });
  // Track cells: the cross.
  ctx.strokeStyle = `rgba(${ink.boneRgb},.16)`;
  ctx.lineWidth = 1;
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const inCross = (x >= 6 && x <= 8) || (y >= 6 && y <= 8);
      const centre = x >= 6 && x <= 8 && y >= 6 && y <= 8;
      if (inCross && !centre) ctx.strokeRect(ox + x * c, oy + y * c, c, c);
    }
  }
  // The track as a loop of 52 cells.
  const loop: [number, number][] = [];
  const push = (x: number, y: number) => loop.push([x, y]);
  for (let x = 1; x <= 5; x++) push(x, 6);
  for (let y = 5; y >= 0; y--) push(6, y);
  push(7, 0);
  for (let y = 0; y <= 5; y++) push(8, y);
  for (let x = 9; x <= 14; x++) push(x, 6);
  push(14, 7);
  for (let x = 14; x >= 9; x--) push(x, 8);
  for (let y = 9; y <= 14; y++) push(8, y);
  push(7, 14);
  for (let y = 14; y >= 9; y--) push(6, y);
  for (let x = 5; x >= 0; x--) push(x, 8);
  push(0, 7);
  push(0, 6);
  const L = loop.length;
  // Tokens hop one cell at a time, a short arc per hop.
  const tokens = [0, 13, 26, 39];
  tokens.forEach((start, i) => {
    const speed = 2.2 + i * 0.35;
    const pos = t * speed + i * 3;
    const cell = Math.floor(pos);
    const hop = frac(pos);
    const [ax, ay] = loop[(start + cell) % L];
    const [bx, by] = loop[(start + cell + 1) % L];
    const x = ox + (ax + (bx - ax) * hop + 0.5) * c;
    const y = oy + (ay + (by - ay) * hop + 0.5) * c - Math.sin(hop * Math.PI) * c * 0.5;
    ctx.fillStyle = i === 0 ? ink.signal : `rgba(${ink.boneRgb},${0.9 - i * 0.18})`;
    ctx.beginPath();
    ctx.arc(x, y, c * 0.3, 0, TAU);
    ctx.fill();
  });
  // Dice in the centre.
  const face = 1 + (Math.floor(t * 1.6) % 6);
  const dx = ox + 6.5 * c;
  const dy = oy + 6.5 * c;
  const ds = c * 2;
  ctx.strokeStyle = `rgba(${ink.boneRgb},.7)`;
  ctx.strokeRect(dx, dy, ds, ds);
  const pip = (u: number, v: number) => {
    ctx.beginPath();
    ctx.arc(dx + ds * u, dy + ds * v, ds * 0.07, 0, TAU);
    ctx.fill();
  };
  ctx.fillStyle = `rgba(${ink.boneRgb},.85)`;
  const P: Record<number, [number, number][]> = {
    1: [[0.5, 0.5]],
    2: [[0.28, 0.28], [0.72, 0.72]],
    3: [[0.28, 0.28], [0.5, 0.5], [0.72, 0.72]],
    4: [[0.28, 0.28], [0.72, 0.28], [0.28, 0.72], [0.72, 0.72]],
    5: [[0.28, 0.28], [0.72, 0.28], [0.5, 0.5], [0.28, 0.72], [0.72, 0.72]],
    6: [[0.28, 0.25], [0.72, 0.25], [0.28, 0.5], [0.72, 0.5], [0.28, 0.75], [0.72, 0.75]],
  };
  P[face].forEach(([u, v]) => pip(u, v));
};

const DRAW: Record<StageKind, Draw> = { trail, trajectory, lan, ludo };

/** A square, theme-aware canvas illustration that only animates while on screen. */
export function Stage({ chapter }: { chapter: Chapter }) {
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const visible = useInView(wrap, '120px');
  const [shown, setShown] = useState(false);

  useEffect(() => {
    if (visible) setShown(true);
  }, [visible]);

  useEffect(() => {
    const el = canvas.current;
    const box = wrap.current;
    if (!el || !box || !visible) return;
    const ctx = el.getContext('2d')!;
    const draw = DRAW[chapter.stage];
    const reduce = reduceMotion();
    let ink = readInk();
    let w = 0;
    let h = 0;
    const size = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = box.clientWidth;
      h = box.clientHeight;
      el.width = Math.round(w * dpr);
      el.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    size();
    const ro = new ResizeObserver(size);
    ro.observe(box);
    const mo = new MutationObserver(() => (ink = readInk()));
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      ctx.clearRect(0, 0, w, h);
      // Reduced motion: one representative still frame.
      draw(ctx, w, h, reduce ? 2.4 : (now - start) / 1000, ink);
      if (!reduce) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      mo.disconnect();
    };
  }, [visible, chapter.stage]);

  return (
    <div className={`stage stage--square ${shown ? 'is-shown' : ''}`} ref={wrap} aria-hidden="true">
      <canvas ref={canvas} />
      {chapter.tags.map((tag, i) => (
        <span
          key={tag.label}
          className={`tag ${tag.hot ? 'tag--hot' : ''}`}
          style={{ '--u': tag.u, '--v': tag.v, '--i': i } as React.CSSProperties}
        >
          {tag.label}
        </span>
      ))}
    </div>
  );
}
