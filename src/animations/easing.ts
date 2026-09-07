export const clamp = (v: number, min = 0, max = 1) => (v < min ? min : v > max ? max : v);

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Frame-rate independent lerp. `lambda` is roughly "smoothing strength". */
export const damp = (current: number, target: number, lambda: number, dt: number) =>
  lerp(current, target, 1 - Math.exp(-lambda * Math.min(dt, 0.1)));

/** 6t^5 - 15t^4 + 10t^3 — zero first *and* second derivative at both ends. */
export const smootherstep = (t: number) => {
  const x = clamp(t);
  return x * x * x * (x * (x * 6 - 15) + 10);
};

export const smoothstep = (t: number) => {
  const x = clamp(t);
  return x * x * (3 - 2 * x);
};

export const easeOutCubic = (t: number) => 1 - Math.pow(1 - clamp(t), 3);

export const easeInOutCubic = (t: number) => {
  const x = clamp(t);
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
};

/** Maps 0→1 to a value that lingers at each integer step — the "dwell" curve. */
export const plateau = (u: number, steps: number) => {
  const f = clamp(u) * steps;
  const i = Math.min(Math.floor(f), steps - 1);
  return i + smootherstep(f - i);
};

export const invLerp = (a: number, b: number, v: number) => (b === a ? 0 : clamp((v - a) / (b - a)));
