import { useEffect, useRef } from 'react';
import { finePointer, readInk, reduceMotion, type Ink } from './hooks';

/**
 * The background: a field of points. In the hero they hold a grid, rows of
 * records in order; scrolling loosens them into drifting dust that streaks
 * with scroll speed. The cursor pushes them aside.
 */
interface Particle {
  hx: number; // home on the grid (px)
  hy: number;
  dx: number; // place in the dust (0..1)
  dy: number;
  depth: number; // 0.25..1, parallax and brightness
  x: number;
  y: number;
  vx: number;
  vy: number;
  hot: boolean;
  phase: number;
  /** Last frame's dust height, to tell a wrap-around from ordinary motion. */
  last: number;
}

const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const smooth = (t: number) => t * t * (3 - 2 * t);

export function Field({ introDelay = 250 }: { introDelay?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current!;
    const ctx = canvas.getContext('2d', { alpha: true })!;
    const reduce = reduceMotion();
    const mobile = () => window.innerWidth <= 860;
    let ink: Ink = readInk();
    let W = 0;
    let H = 0;
    let dpr = 1;
    let particles: Particle[] = [];
    const pointer = { x: -9999, y: -9999 };
    let lastScroll = window.scrollY;
    let streak = 0;
    let raf = 0;
    const born = performance.now() + introDelay;

    function build() {
      dpr = Math.min(window.devicePixelRatio || 1, mobile() ? 1.5 : 2);
      W = window.innerWidth;
      H = window.innerHeight;
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      canvas.style.width = `${W}px`;
      canvas.style.height = `${H}px`;

      const cores = navigator.hardwareConcurrency || 4;
      const target = mobile() ? 900 : cores >= 8 ? 2600 : 1800;
      // A grid of records: short rows, wide gutters, filling the hero.
      const gap = Math.max(14, Math.sqrt((W * H) / target));
      const cols = Math.floor(W / gap);
      const rows = Math.floor(H / gap);
      const ox = (W - (cols - 1) * gap) / 2;
      const oy = (H - (rows - 1) * gap) / 2;
      const next: Particle[] = [];
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          // Leave ragged gaps so it reads as data, not graph paper.
          if (Math.random() < 0.18) continue;
          const old = particles[next.length];
          next.push({
            hx: ox + c * gap,
            hy: oy + r * gap,
            dx: Math.random(),
            dy: Math.random(),
            depth: 0.25 + Math.random() * 0.75,
            x: old ? old.x : Math.random() * W,
            y: old ? old.y : Math.random() * H,
            vx: 0,
            vy: 0,
            hot: Math.random() < 0.035,
            phase: Math.random() * Math.PI * 2,
            last: NaN,
          });
        }
      }
      particles = next;
    }

    function frame(now: number) {
      raf = requestAnimationFrame(frame);
      if (document.hidden) return;
      const t = now / 1000;
      const sy = window.scrollY;
      const dScroll = sy - lastScroll;
      lastScroll = sy;
      streak += (clamp(Math.abs(dScroll) / 40, 0, 1) * Math.sign(dScroll) - streak) * 0.18;

      // Order: the intro snaps the grid together; scrolling past the hero lets it go.
      const intro = reduce ? 1 : smooth(clamp((now - born) / 1700));
      const order = intro * (1 - smooth(clamp(sy / (H * 0.85))));

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);

      const pr = 110;
      for (const p of particles) {
        // Dust drifts slowly and scrolls at its own depth (parallax), wrapping around.
        const driftX = p.dx * W + Math.sin(t * 0.15 + p.phase) * 18 * p.depth;
        let driftY = (p.dy * H * 1.4 - sy * 0.18 * p.depth + t * 6 * p.depth) % (H * 1.4);
        if (driftY < 0) driftY += H * 1.4;
        driftY -= H * 0.2;
        const tx = p.hx * order + driftX * (1 - order);
        const ty = p.hy * order + driftY * (1 - order);

        // Spring towards the target, with a push away from the cursor.
        let fx = (tx - p.x) * 0.06;
        let fy = (ty - p.y) * 0.06;
        const ex = p.x - pointer.x;
        const ey = p.y - pointer.y;
        const d2 = ex * ex + ey * ey;
        if (d2 < pr * pr) {
          const d = Math.sqrt(d2) || 1;
          const f = (1 - d / pr) * 3.2;
          fx += (ex / d) * f;
          fy += (ey / d) * f;
        }
        p.vx = (p.vx + fx) * 0.78;
        p.vy = (p.vy + fy) * 0.78;
        // Dust that wrapped around the screen teleports instead of streaking across it.
        const wrapped = Math.abs(driftY - p.last) > H * 0.5;
        p.last = driftY;
        if (wrapped && order < 0.5) {
          p.x = tx;
          p.y = ty;
          p.vx = p.vy = 0;
        } else {
          p.x += p.vx;
          p.y += p.vy;
        }
        if (p.y < -10 || p.y > H + 10) continue;

        const twinkle = 0.75 + 0.25 * Math.sin(t * 1.3 + p.phase);
        const a = (0.1 + 0.32 * p.depth) * twinkle * (0.55 + 0.45 * order + 0.25 * (1 - order));
        ctx.fillStyle = p.hot ? `rgba(${ink.signalRgb},${Math.min(1, a * 2.2)})` : `rgba(${ink.boneRgb},${a})`;
        const len = Math.abs(streak) * 26 * p.depth * (1 - order);
        const s = p.hot ? 2 : 1.4;
        if (order > 0.5) {
          // Ordered: short horizontal dashes, like rows in a table.
          ctx.fillRect(p.x - s * 1.5, p.y, s * 3 * (0.6 + 0.4 * order), s * 0.9);
        } else {
          ctx.fillRect(p.x, p.y - (streak > 0 ? len : 0), s, s + len);
        }
      }
    }

    build();
    raf = requestAnimationFrame(frame);

    let resizeTimer = 0;
    let lastW = window.innerWidth;
    const onResize = () => {
      // Ignore mobile URL-bar height jitter; rebuild on real layout changes.
      if (Math.abs(window.innerWidth - lastW) < 2 && mobile()) return;
      lastW = window.innerWidth;
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(build, 140);
    };
    const onMove = (e: PointerEvent) => {
      pointer.x = e.clientX;
      pointer.y = e.clientY;
    };
    const onLeave = () => {
      pointer.x = pointer.y = -9999;
    };
    const onTheme = new MutationObserver(() => {
      ink = readInk();
    });
    onTheme.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    window.addEventListener('resize', onResize);
    if (finePointer()) {
      window.addEventListener('pointermove', onMove, { passive: true });
      document.documentElement.addEventListener('pointerleave', onLeave);
    }
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(resizeTimer);
      onTheme.disconnect();
      window.removeEventListener('resize', onResize);
      window.removeEventListener('pointermove', onMove);
      document.documentElement.removeEventListener('pointerleave', onLeave);
    };
  }, [introDelay]);

  return <canvas className="field" ref={ref} aria-hidden="true" />;
}
