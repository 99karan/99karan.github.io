import { roundRect, tracked, type Draw } from './canvasTexture';
import { PALETTE as P, display, mono, rgba } from './palette';
import type { Milestone, Project } from '../data/portfolio';

/* ------------------------------------------------------------------ */
/* shared bits                                                         */
/* ------------------------------------------------------------------ */

function hairline(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, color: string) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

function corners(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, len: number, color: string) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  const pts: [number, number, number, number][] = [
    [x, y + len, x, y],
    [x, y, x + len, y],
    [x + w - len, y, x + w, y],
    [x + w, y, x + w, y + len],
    [x + w, y + h - len, x + w, y + h],
    [x + w, y + h, x + w - len, y + h],
    [x + len, y + h, x, y + h],
    [x, y + h, x, y + h - len],
  ];
  ctx.beginPath();
  pts.forEach(([a, b, c, d], i) => {
    if (i % 2 === 0) ctx.moveTo(a, b);
    ctx.lineTo(c, d);
  });
  ctx.stroke();
}

function wrap(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number) {
  const words = text.split(' ');
  let line = '';
  let cursorY = y;
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, cursorY);
      line = word;
      cursorY += lineHeight;
    } else {
      line = test;
    }
  }
  if (line) ctx.fillText(line, x, cursorY);
  return cursorY + lineHeight;
}

const CODE_LINES: [number, number][] = [
  [0, 0.42], [1, 0.62], [1, 0.5], [2, 0.34], [1, 0.7], [0, 0.28],
  [0, 0.55], [1, 0.45], [2, 0.6], [2, 0.38], [1, 0.66], [0, 0.3],
  [0, 0.48], [1, 0.58], [1, 0.36], [2, 0.52],
];

function codeBackdrop(ctx: CanvasRenderingContext2D, w: number, h: number, alpha: number) {
  const top = h * 0.16;
  const step = (h * 0.74) / CODE_LINES.length;
  ctx.save();
  CODE_LINES.forEach(([indent, len], i) => {
    const y = top + i * step;
    ctx.fillStyle = rgba(P.dim, alpha * 0.5);
    ctx.font = mono(step * 0.34);
    ctx.fillText(String(i + 1).padStart(2, '0'), w * 0.035, y);
    ctx.fillStyle = rgba(i % 4 === 0 ? P.accent : P.dim, alpha);
    roundRect(ctx, w * 0.085 + indent * w * 0.035, y - step * 0.32, len * w * 0.55, step * 0.3, step * 0.15);
    ctx.fill();
  });
  ctx.restore();
}

/* ------------------------------------------------------------------ */
/* Hero monitor                                                        */
/* ------------------------------------------------------------------ */

export const drawMonitor =
  (name: string, role: string, tagline: string): Draw =>
  (ctx, w, h) => {
    const bg = ctx.createLinearGradient(0, 0, w * 0.6, h);
    bg.addColorStop(0, '#080d14');
    bg.addColorStop(0.55, '#060a10');
    bg.addColorStop(1, '#04070c');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    // faint code behind everything
    codeBackdrop(ctx, w, h, 0.1);

    // window chrome
    ctx.fillStyle = 'rgba(255,255,255,0.03)';
    ctx.fillRect(0, 0, w, h * 0.075);
    hairline(ctx, 0, h * 0.075, w, h * 0.075, 'rgba(255,255,255,0.08)');
    [P.faint, P.faint, P.accent].forEach((c, i) => {
      ctx.fillStyle = rgba(c, i === 2 ? 0.9 : 0.4);
      ctx.beginPath();
      ctx.arc(w * 0.028 + i * w * 0.022, h * 0.0375, h * 0.008, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.fillStyle = rgba(P.dim, 0.65);
    ctx.font = mono(h * 0.026);
    ctx.fillText('karan_prajapat.dart', w * 0.12, h * 0.046);
    ctx.textAlign = 'right';
    ctx.fillStyle = rgba(P.accent, 0.7);
    ctx.fillText('● LIVE', w * 0.97, h * 0.046);
    ctx.textAlign = 'left';

    // centre plate
    const px = w * 0.5;
    ctx.textAlign = 'center';

    ctx.fillStyle = rgba(P.accent, 0.85);
    ctx.font = mono(h * 0.028, 500);
    tracked(ctx, 'PORTFOLIO / 2026', px, h * 0.3, h * 0.014, 'center');

    ctx.fillStyle = P.text;
    ctx.font = display(h * 0.135, 500);
    ctx.shadowColor = rgba(P.accent, 0.32);
    ctx.shadowBlur = h * 0.06;
    tracked(ctx, name, px, h * 0.475, h * 0.016, 'center');
    ctx.shadowBlur = 0;

    hairline(ctx, px - w * 0.11, h * 0.535, px + w * 0.11, h * 0.535, rgba(P.accent, 0.35));

    ctx.fillStyle = rgba(P.text, 0.82);
    ctx.font = mono(h * 0.038, 400);
    tracked(ctx, role.toUpperCase(), px, h * 0.615, h * 0.012, 'center');

    ctx.fillStyle = rgba(P.dim, 0.85);
    ctx.font = display(h * 0.036, 300);
    ctx.textAlign = 'center';
    wrap(ctx, tagline, px, h * 0.71, w * 0.7, h * 0.055);

    // status bar
    ctx.textAlign = 'left';
    hairline(ctx, 0, h * 0.925, w, h * 0.925, 'rgba(255,255,255,0.07)');
    ctx.fillStyle = rgba(P.faint, 0.85);
    ctx.font = mono(h * 0.026);
    ctx.fillText('main ✓  flutter · dart · firebase', w * 0.03, h * 0.965);
    ctx.textAlign = 'right';
    ctx.fillStyle = rgba(P.accent, 0.75);
    ctx.fillText('BUILD OK', w * 0.97, h * 0.965);
    ctx.textAlign = 'left';

    // scanline sheen
    const sheen = ctx.createLinearGradient(0, 0, 0, h);
    sheen.addColorStop(0, 'rgba(255,255,255,0.05)');
    sheen.addColorStop(0.5, 'rgba(255,255,255,0)');
    sheen.addColorStop(1, 'rgba(102,224,192,0.035)');
    ctx.fillStyle = sheen;
    ctx.fillRect(0, 0, w, h);
  };

/* ------------------------------------------------------------------ */
/* Phone                                                               */
/* ------------------------------------------------------------------ */

export const drawPhone: Draw = (ctx, w, h) => {
  ctx.fillStyle = '#070b11';
  ctx.fillRect(0, 0, w, h);

  ctx.fillStyle = rgba(P.faint, 0.8);
  ctx.font = mono(w * 0.045);
  ctx.fillText('9:41', w * 0.1, h * 0.06);
  ctx.textAlign = 'right';
  ctx.fillText('▮▮▮', w * 0.9, h * 0.06);
  ctx.textAlign = 'left';

  ctx.fillStyle = rgba(P.dim, 0.75);
  ctx.font = mono(w * 0.05);
  ctx.fillText('FINCARD', w * 0.1, h * 0.15);
  ctx.fillStyle = P.text;
  ctx.font = display(w * 0.115, 500);
  ctx.fillText('₹ 24,860', w * 0.1, h * 0.225);

  // chart
  const cx = w * 0.1;
  const cw = w * 0.8;
  const cy = h * 0.42;
  const ch = h * 0.14;
  const pts = [0.35, 0.5, 0.42, 0.68, 0.58, 0.8, 0.72, 0.95];
  ctx.strokeStyle = P.accent;
  ctx.lineWidth = w * 0.012;
  ctx.beginPath();
  pts.forEach((p, i) => {
    const x = cx + (cw * i) / (pts.length - 1);
    const y = cy + ch - p * ch;
    i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
  });
  ctx.stroke();
  const fill = ctx.createLinearGradient(0, cy, 0, cy + ch);
  fill.addColorStop(0, rgba(P.accent, 0.28));
  fill.addColorStop(1, rgba(P.accent, 0));
  ctx.lineTo(cx + cw, cy + ch);
  ctx.lineTo(cx, cy + ch);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();

  // rows
  ['Lesson 04 · Compounding', 'Budget · On track', 'Streak · 12 days'].forEach((label, i) => {
    const y = h * 0.55 + i * h * 0.1;
    ctx.strokeStyle = 'rgba(255,255,255,0.07)';
    ctx.lineWidth = 1;
    roundRect(ctx, w * 0.09, y, w * 0.82, h * 0.075, w * 0.03);
    ctx.stroke();
    ctx.fillStyle = rgba(i === 0 ? P.accent : P.dim, 0.85);
    ctx.font = mono(w * 0.042);
    ctx.fillText(label, w * 0.15, y + h * 0.049);
    ctx.fillStyle = rgba(i === 0 ? P.accent : P.faint, 0.9);
    ctx.beginPath();
    ctx.arc(w * 0.125, y + h * 0.0375, w * 0.012, 0, Math.PI * 2);
    ctx.fill();
  });

  ctx.fillStyle = 'rgba(255,255,255,0.16)';
  roundRect(ctx, w * 0.36, h * 0.94, w * 0.28, h * 0.008, h * 0.004);
  ctx.fill();
};

/* ------------------------------------------------------------------ */
/* Holographic panels (drawn on transparent canvases, additive)        */
/* ------------------------------------------------------------------ */

function holoFrame(ctx: CanvasRenderingContext2D, w: number, h: number, label: string, color: string = P.accent) {
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = rgba(color, 0.05);
  roundRect(ctx, 2, 2, w - 4, h - 4, 8);
  ctx.fill();
  corners(ctx, 6, 6, w - 12, h - 12, Math.min(w, h) * 0.09, rgba(color, 0.55));
  ctx.fillStyle = rgba(color, 0.8);
  ctx.font = mono(h * 0.058, 500);
  tracked(ctx, label, w * 0.07, h * 0.135, h * 0.02);
  hairline(ctx, w * 0.07, h * 0.19, w * 0.93, h * 0.19, rgba(color, 0.22));
}

export const drawHoloCode: Draw = (ctx, w, h) => {
  holoFrame(ctx, w, h, 'BUILD LOG');
  const rows = [
    'flutter run --release',
    'analyzing project...',
    'no issues found (2.1s)',
    '✓ riverpod providers  12',
    '✓ widget tests        34',
    '✓ firebase connected',
  ];
  ctx.font = mono(h * 0.062);
  rows.forEach((row, i) => {
    ctx.fillStyle = rgba(row.startsWith('✓') ? P.accent : P.text, row.startsWith('✓') ? 0.85 : 0.55);
    ctx.fillText(row, w * 0.07, h * 0.31 + i * h * 0.105);
  });
};

export const drawHoloMetrics: Draw = (ctx, w, h) => {
  holoFrame(ctx, w, h, 'SYSTEM', P.blue);
  const bars = [0.86, 0.62, 0.74, 0.45, 0.9, 0.58, 0.7];
  const bw = (w * 0.86) / (bars.length * 1.6);
  bars.forEach((v, i) => {
    const x = w * 0.07 + i * bw * 1.6;
    ctx.fillStyle = rgba(P.blue, 0.16);
    roundRect(ctx, x, h * 0.3, bw, h * 0.52, bw * 0.25);
    ctx.fill();
    ctx.fillStyle = rgba(P.blue, 0.75);
    roundRect(ctx, x, h * 0.82 - v * h * 0.52, bw, v * h * 0.52, bw * 0.25);
    ctx.fill();
  });
  ctx.fillStyle = rgba(P.text, 0.6);
  ctx.font = mono(h * 0.06);
  ctx.fillText('60 FPS · 0 JANK', w * 0.07, h * 0.94);
};

export const drawHoloWave: Draw = (ctx, w, h) => {
  holoFrame(ctx, w, h, 'SIGNAL', P.amber);
  ctx.strokeStyle = rgba(P.amber, 0.8);
  ctx.lineWidth = Math.max(1.5, h * 0.012);
  ctx.beginPath();
  for (let x = 0; x <= w * 0.86; x += 2) {
    const t = x / (w * 0.86);
    const y =
      h * 0.58 +
      Math.sin(t * Math.PI * 4) * h * 0.16 * Math.sin(t * Math.PI) +
      Math.sin(t * Math.PI * 11) * h * 0.05;
    const px = w * 0.07 + x;
    x === 0 ? ctx.moveTo(px, y) : ctx.lineTo(px, y);
  }
  ctx.stroke();
  ctx.fillStyle = rgba(P.text, 0.55);
  ctx.font = mono(h * 0.06);
  ctx.fillText('LATENCY 42ms', w * 0.07, h * 0.92);
};

/* ------------------------------------------------------------------ */
/* About: profile + stat readouts                                      */
/* ------------------------------------------------------------------ */

export const drawProfilePanel =
  (name: string, role: string, location: string): Draw =>
  (ctx, w, h) => {
    holoFrame(ctx, w, h, 'PROFILE // 01');

    ctx.fillStyle = rgba(P.text, 0.95);
    ctx.font = display(h * 0.13, 500);
    tracked(ctx, name, w * 0.07, h * 0.36, h * 0.014);

    ctx.fillStyle = rgba(P.accent, 0.85);
    ctx.font = mono(h * 0.055);
    tracked(ctx, role.toUpperCase(), w * 0.07, h * 0.46, h * 0.014);

    const rows: [string, string][] = [
      ['LOCATION', location],
      ['FOCUS', 'Mobile products · APIs · Systems'],
      ['STACK', 'Flutter · Dart · Riverpod · Firebase'],
      ['STATUS', 'Open to new work'],
    ];

    rows.forEach(([key, value], i) => {
      const y = h * 0.62 + i * h * 0.105;
      hairline(ctx, w * 0.07, y - h * 0.055, w * 0.93, y - h * 0.055, 'rgba(255,255,255,0.07)');
      ctx.fillStyle = rgba(P.faint, 0.9);
      ctx.font = mono(h * 0.045, 500);
      tracked(ctx, key, w * 0.07, y, h * 0.012);
      ctx.fillStyle = rgba(P.text, 0.72);
      ctx.font = display(h * 0.055, 300);
      ctx.textAlign = 'right';
      ctx.fillText(value, w * 0.93, y);
      ctx.textAlign = 'left';
    });
  };

export const drawStatPlate =
  (value: string, label: string, note: string, color: string = P.accent): Draw =>
  (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = rgba(color, 0.045);
    roundRect(ctx, 2, 2, w - 4, h - 4, 6);
    ctx.fill();
    ctx.strokeStyle = rgba(color, 0.22);
    ctx.lineWidth = 1.5;
    roundRect(ctx, 2, 2, w - 4, h - 4, 6);
    ctx.stroke();
    ctx.fillStyle = rgba(color, 0.9);
    ctx.fillRect(0, 0, 3, h);

    ctx.fillStyle = rgba(P.text, 0.95);
    ctx.font = display(h * 0.3, 500);
    ctx.fillText(value, w * 0.07, h * 0.44);

    ctx.fillStyle = rgba(color, 0.85);
    ctx.font = mono(h * 0.1, 500);
    tracked(ctx, label.toUpperCase(), w * 0.07, h * 0.66, h * 0.03);

    ctx.fillStyle = rgba(P.dim, 0.7);
    ctx.font = display(h * 0.1, 300);
    ctx.fillText(note, w * 0.07, h * 0.86);
  };

/* ------------------------------------------------------------------ */
/* Skills                                                              */
/* ------------------------------------------------------------------ */

export const drawSkillLabel =
  (name: string, color: string): Draw =>
  (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    ctx.font = mono(h * 0.46, 500);
    ctx.textAlign = 'center';
    ctx.fillStyle = rgba(color, 0.95);
    ctx.shadowColor = rgba(color, 0.5);
    ctx.shadowBlur = h * 0.2;
    tracked(ctx, name.toUpperCase(), w / 2, h * 0.63, h * 0.06, 'center');
    ctx.shadowBlur = 0;
    ctx.textAlign = 'left';
  };

/* ------------------------------------------------------------------ */
/* Projects                                                            */
/* ------------------------------------------------------------------ */

export const drawProjectMock =
  (project: Project): Draw =>
  (ctx, w, h) => {
    const a = project.accent;
    ctx.fillStyle = '#070a10';
    ctx.fillRect(0, 0, w, h);

    // chrome
    ctx.fillStyle = 'rgba(255,255,255,0.035)';
    ctx.fillRect(0, 0, w, h * 0.09);
    hairline(ctx, 0, h * 0.09, w, h * 0.09, 'rgba(255,255,255,0.07)');
    ctx.fillStyle = rgba(a, 0.9);
    ctx.beginPath();
    ctx.arc(w * 0.035, h * 0.045, h * 0.011, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = rgba(P.dim, 0.7);
    ctx.font = mono(h * 0.03);
    ctx.fillText(project.title.toLowerCase().replace(/\s+/g, '-'), w * 0.06, h * 0.056);
    ctx.textAlign = 'right';
    ctx.fillStyle = rgba(P.faint, 0.8);
    ctx.fillText(project.index, w * 0.965, h * 0.056);
    ctx.textAlign = 'left';

    const body = { x: w * 0.06, y: h * 0.17, w: w * 0.88, h: h * 0.62 };

    if (project.mock === 'app') {
      // phone frames on a soft field
      const g = ctx.createRadialGradient(w * 0.5, h * 0.5, 0, w * 0.5, h * 0.5, w * 0.6);
      g.addColorStop(0, rgba(a, 0.09));
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      const pw = w * 0.17;
      const ph = pw * 2.02;
      [-1, 0, 1].forEach((i) => {
        const x = w * 0.5 + i * pw * 1.28 - pw / 2;
        const y = h * 0.5 - ph / 2 + Math.abs(i) * h * 0.045;
        ctx.fillStyle = i === 0 ? '#0d131c' : '#0a0f16';
        roundRect(ctx, x, y, pw, ph, pw * 0.13);
        ctx.fill();
        ctx.strokeStyle = rgba(a, i === 0 ? 0.5 : 0.2);
        ctx.lineWidth = 1.5;
        roundRect(ctx, x, y, pw, ph, pw * 0.13);
        ctx.stroke();
        ctx.fillStyle = rgba(a, i === 0 ? 0.75 : 0.3);
        roundRect(ctx, x + pw * 0.12, y + ph * 0.12, pw * 0.5, ph * 0.035, ph * 0.017);
        ctx.fill();
        for (let r = 0; r < 4; r++) {
          ctx.fillStyle = rgba(P.dim, i === 0 ? 0.28 : 0.14);
          roundRect(ctx, x + pw * 0.12, y + ph * 0.26 + r * ph * 0.12, pw * 0.76, ph * 0.075, ph * 0.02);
          ctx.fill();
        }
      });
    } else if (project.mock === 'terminal') {
      ctx.font = mono(h * 0.038);
      const rows = [
        ['$ python backtest.py --strategy mean_rev', P.dim],
        ['loading 5y ohlcv ............ ok', P.faint],
        ['runs: 248   sharpe: 1.42', a],
        ['max drawdown: -8.4%', P.faint],
        ['hit rate: 57.8%   exposure: 0.31', a],
      ];
      rows.forEach((row, i) => {
        ctx.fillStyle = rgba(row[1] as string, 0.9);
        ctx.fillText(row[0] as string, body.x, body.y + i * h * 0.062);
      });
      // equity curve
      const cy = h * 0.58;
      const chh = h * 0.24;
      ctx.strokeStyle = rgba(a, 0.85);
      ctx.lineWidth = h * 0.006;
      ctx.beginPath();
      for (let i = 0; i <= 60; i++) {
        const t = i / 60;
        const v = t * 0.8 + Math.sin(t * 9) * 0.09 + Math.sin(t * 21) * 0.04;
        const x = body.x + t * body.w;
        const y = cy + chh - v * chh;
        i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      }
      ctx.stroke();
      hairline(ctx, body.x, cy + chh, body.x + body.w, cy + chh, 'rgba(255,255,255,0.09)');
    } else if (project.mock === 'canvas') {
      const cx = w * 0.5;
      const cy = h * 0.52;
      ctx.strokeStyle = rgba(a, 0.5);
      ctx.lineWidth = 1.2;
      for (let r = 1; r <= 5; r++) {
        ctx.globalAlpha = 1 - r * 0.15;
        ctx.beginPath();
        ctx.ellipse(cx, cy, r * w * 0.075, r * w * 0.075 * 0.34, -0.35, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      ctx.fillStyle = rgba(a, 0.9);
      ctx.beginPath();
      ctx.arc(cx, cy, w * 0.028, 0, Math.PI * 2);
      ctx.fill();
      for (let i = 0; i < 34; i++) {
        const ang = (i / 34) * Math.PI * 2;
        const rr = w * 0.09 + ((i * 37) % 100) * w * 0.0026;
        ctx.fillStyle = rgba(i % 3 ? P.text : a, 0.35);
        ctx.beginPath();
        ctx.arc(cx + Math.cos(ang) * rr, cy + Math.sin(ang) * rr * 0.36, w * 0.004, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      // grid of app tiles
      const cols = 4;
      const rows = 2;
      const gap = w * 0.022;
      const tw = (body.w - gap * (cols - 1)) / cols;
      const th = (body.h - gap * (rows - 1)) / rows;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const i = r * cols + c;
          const x = body.x + c * (tw + gap);
          const y = body.y + r * (th + gap);
          ctx.fillStyle = 'rgba(255,255,255,0.028)';
          roundRect(ctx, x, y, tw, th, tw * 0.08);
          ctx.fill();
          ctx.strokeStyle = i === 0 ? rgba(a, 0.45) : 'rgba(255,255,255,0.06)';
          ctx.lineWidth = 1.2;
          roundRect(ctx, x, y, tw, th, tw * 0.08);
          ctx.stroke();
          ctx.fillStyle = rgba(i % 3 === 0 ? a : P.dim, 0.5);
          roundRect(ctx, x + tw * 0.12, y + th * 0.18, tw * 0.3, tw * 0.3, tw * 0.08);
          ctx.fill();
          ctx.fillStyle = 'rgba(255,255,255,0.14)';
          roundRect(ctx, x + tw * 0.12, y + th * 0.66, tw * 0.62, th * 0.06, th * 0.03);
          ctx.fill();
          roundRect(ctx, x + tw * 0.12, y + th * 0.78, tw * 0.4, th * 0.06, th * 0.03);
          ctx.fill();
        }
      }
    }

    // footer
    hairline(ctx, 0, h * 0.855, w, h * 0.855, 'rgba(255,255,255,0.07)');
    ctx.fillStyle = rgba(P.text, 0.9);
    ctx.font = display(h * 0.062, 500);
    ctx.fillText(project.title, w * 0.06, h * 0.935);
    ctx.textAlign = 'right';
    ctx.fillStyle = rgba(a, 0.8);
    ctx.font = mono(h * 0.032);
    tracked(ctx, project.tech.slice(0, 3).join(' · ').toUpperCase(), w * 0.94, h * 0.93, h * 0.008);
    ctx.textAlign = 'left';

    const sheen = ctx.createLinearGradient(0, 0, w * 0.4, h);
    sheen.addColorStop(0, 'rgba(255,255,255,0.05)');
    sheen.addColorStop(0.6, 'rgba(255,255,255,0)');
    ctx.fillStyle = sheen;
    ctx.fillRect(0, 0, w, h);
  };

/* ------------------------------------------------------------------ */
/* Experience                                                          */
/* ------------------------------------------------------------------ */

export const drawMilestone =
  (m: Milestone): Draw =>
  (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = rgba(P.accent, 0.9);
    ctx.font = mono(h * 0.115, 500);
    tracked(ctx, m.period, 0, h * 0.16, h * 0.035);

    ctx.fillStyle = rgba(P.text, 0.95);
    ctx.font = display(h * 0.2, 500);
    ctx.fillText(m.role, 0, h * 0.42);

    ctx.fillStyle = rgba(P.dim, 0.75);
    ctx.font = display(h * 0.115, 300);
    ctx.fillText(m.org, 0, h * 0.58);

    ctx.fillStyle = rgba(P.faint, 0.9);
    ctx.font = mono(h * 0.095);
    tracked(ctx, m.tags.join('  ·  ').toUpperCase(), 0, h * 0.84, h * 0.022);
  };

/* ------------------------------------------------------------------ */
/* Resume document                                                     */
/* ------------------------------------------------------------------ */

export const drawResumePage =
  (name: string, role: string): Draw =>
  (ctx, w, h) => {
    ctx.fillStyle = '#f4f6f9';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#e9edf3';
    ctx.fillRect(0, 0, w * 0.34, h);

    ctx.fillStyle = '#10141c';
    ctx.font = display(h * 0.045, 600);
    tracked(ctx, name, w * 0.06, h * 0.1, h * 0.006);
    ctx.fillStyle = '#5a6478';
    ctx.font = mono(h * 0.022);
    tracked(ctx, role.toUpperCase(), w * 0.06, h * 0.135, h * 0.006);

    ctx.strokeStyle = 'rgba(16,20,28,0.14)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(w * 0.06, h * 0.16);
    ctx.lineTo(w * 0.94, h * 0.16);
    ctx.stroke();

    const block = (x: number, y: number, bw: number, lines: number, alpha: number) => {
      for (let i = 0; i < lines; i++) {
        ctx.fillStyle = `rgba(16,20,28,${alpha * (i === 0 ? 1.6 : 1)})`;
        const lw = i === 0 ? bw * 0.55 : bw * (0.75 + ((i * 29) % 25) / 100);
        roundRect(ctx, x, y + i * h * 0.032, lw, h * (i === 0 ? 0.014 : 0.009), h * 0.005);
        ctx.fill();
      }
    };

    block(w * 0.06, h * 0.21, w * 0.24, 5, 0.16);
    block(w * 0.06, h * 0.42, w * 0.24, 6, 0.16);
    block(w * 0.06, h * 0.66, w * 0.24, 4, 0.16);

    block(w * 0.4, h * 0.21, w * 0.54, 6, 0.2);
    block(w * 0.4, h * 0.46, w * 0.54, 6, 0.2);
    block(w * 0.4, h * 0.71, w * 0.54, 5, 0.2);

    ctx.fillStyle = 'rgba(102,224,192,0.9)';
    ctx.fillRect(0, 0, w * 0.008, h);
  };

/* ------------------------------------------------------------------ */
/* Contact icons                                                       */
/* ------------------------------------------------------------------ */

export const drawSocialIcon =
  (id: string, label: string, color: string): Draw =>
  (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    const cx = w / 2;
    const cy = h * 0.42;
    const r = Math.min(w, h) * 0.2;

    ctx.strokeStyle = rgba(color, 0.9);
    ctx.fillStyle = rgba(color, 0.9);
    ctx.lineWidth = Math.max(2, r * 0.11);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (id === 'github') {
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx, cy - r * 0.12, r * 0.42, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx - r * 0.42, cy + r * 0.42);
      ctx.lineTo(cx - r * 0.42, cy + r * 0.72);
      ctx.moveTo(cx + r * 0.42, cy + r * 0.42);
      ctx.lineTo(cx + r * 0.42, cy + r * 0.72);
      ctx.stroke();
    } else if (id === 'linkedin') {
      ctx.beginPath();
      roundRect(ctx, cx - r, cy - r, r * 2, r * 2, r * 0.28);
      ctx.stroke();
      ctx.fillRect(cx - r * 0.58, cy - r * 0.2, r * 0.2, r * 0.82);
      ctx.beginPath();
      ctx.arc(cx - r * 0.48, cy - r * 0.5, r * 0.14, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(cx - r * 0.05, cy + r * 0.62);
      ctx.lineTo(cx - r * 0.05, cy - r * 0.2);
      ctx.moveTo(cx - r * 0.05, cy + r * 0.05);
      ctx.quadraticCurveTo(cx + r * 0.35, cy - r * 0.35, cx + r * 0.52, cy + r * 0.1);
      ctx.lineTo(cx + r * 0.52, cy + r * 0.62);
      ctx.stroke();
    } else {
      ctx.beginPath();
      roundRect(ctx, cx - r * 1.15, cy - r * 0.78, r * 2.3, r * 1.56, r * 0.18);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx - r * 1.05, cy - r * 0.66);
      ctx.lineTo(cx, cy + r * 0.2);
      ctx.lineTo(cx + r * 1.05, cy - r * 0.66);
      ctx.stroke();
    }

    ctx.fillStyle = rgba(P.text, 0.85);
    ctx.font = mono(h * 0.085, 500);
    ctx.textAlign = 'center';
    tracked(ctx, label.toUpperCase(), cx, h * 0.85, h * 0.03, 'center');
    ctx.textAlign = 'left';
  };

export const drawTitlePlate =
  (title: string, sub: string): Draw =>
  (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    ctx.textAlign = 'center';
    ctx.fillStyle = rgba(P.text, 0.95);
    ctx.font = display(h * 0.34, 500);
    ctx.shadowColor = rgba(P.accent, 0.28);
    ctx.shadowBlur = h * 0.14;
    tracked(ctx, title, w / 2, h * 0.44, h * 0.03, 'center');
    ctx.shadowBlur = 0;
    ctx.fillStyle = rgba(P.accent, 0.75);
    ctx.font = mono(h * 0.1, 400);
    tracked(ctx, sub, w / 2, h * 0.72, h * 0.05, 'center');
    ctx.textAlign = 'left';
  };
