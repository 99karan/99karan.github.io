/**
 * The island, as maths.
 *
 * Every system reads the world through this file: terrain mesh, physics,
 * water shading, prop placement and the minimap all call `groundAt` /
 * `terrainAt`, so what you see and what you drive on can never disagree.
 *
 * Conventions: metres, +Y up, the island is centred on the origin, sea level
 * is y = 0. "North" is -Z (the direction you face at spawn).
 */

export const WATER_LEVEL = 0;
export const WORLD_SIZE = 620; // terrain mesh extent (square)

/* ------------------------------------------------------------------ noise */

function hash(ix: number, iz: number) {
  let h = (ix * 374761393 + iz * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967295;
}

function valueNoise(x: number, z: number) {
  const ix = Math.floor(x);
  const iz = Math.floor(z);
  const fx = x - ix;
  const fz = z - iz;
  const ux = fx * fx * (3 - 2 * fx);
  const uz = fz * fz * (3 - 2 * fz);
  const a = hash(ix, iz);
  const b = hash(ix + 1, iz);
  const c = hash(ix, iz + 1);
  const d = hash(ix + 1, iz + 1);
  return a + (b - a) * ux + (c - a) * uz + (a - b - c + d) * ux * uz;
}

export function fbm(x: number, z: number, octaves = 4) {
  let sum = 0;
  let amp = 0.5;
  let freq = 1;
  for (let i = 0; i < octaves; i++) {
    sum += valueNoise(x * freq, z * freq) * amp;
    freq *= 2.03;
    amp *= 0.5;
  }
  return sum / (1 - Math.pow(0.5, octaves));
}

/** Deterministic pseudo-random sequence for prop placement. */
export function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const smooth = (e0: number, e1: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/* -------------------------------------------------------------- coastline */

const MARINA_ANGLE = 1.75; // a bay carved into the south coast

function angleDelta(a: number, b: number) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

export function coastRadius(theta: number) {
  const bay = angleDelta(theta, MARINA_ANGLE);
  return (
    230 +
    18 * Math.sin(3 * theta + 0.6) +
    11 * Math.sin(5 * theta + 2.1) +
    7 * Math.sin(9 * theta + 0.4) -
    58 * Math.exp(-(bay * bay) / 0.03)
  );
}

/** Point on the shoreline in direction `theta`, pulled `inset` metres inland. */
export function shorePoint(theta: number, inset = 0): [number, number] {
  const r = coastRadius(theta) - inset;
  return [Math.cos(theta) * r, Math.sin(theta) * r];
}

/* ---------------------------------------------------------------- layout */

export const SPAWN = { x: 0, z: 26, yaw: Math.PI }; // facing north (-Z)

export const MOUNTAIN = { x: -62, z: -176, height: 52, sigma: 40 };
const EAST_HILL = { x: 112, z: -150, height: 24, sigma: 30 };

export const RUNWAY = { x: 152, z: 10, halfW: 11, halfL: 108, height: 2.8 };

export const ZONES = {
  plaza: { x: 0, z: 0, r: 46 },
  about: { x: -40, z: 22 },
  resume: { x: 44, z: -14 },
  skills: { x: -118, z: 22 },
  projects: { x: -86, z: -84 },
  hangar: { x: 124, z: -46 },
  bowling: { x: -6, z: -78 },
} as const;

export const LIGHTHOUSE = (() => {
  const [x, z] = shorePoint(0.92, 14);
  return { x, z };
})();

export const MARINA = (() => {
  const theta = MARINA_ANGLE;
  const [sx, sz] = shorePoint(theta, 0);
  const dir = { x: Math.cos(theta), z: Math.sin(theta) };
  return {
    theta,
    shore: { x: sx, z: sz },
    dir,
    /** Dock deck: starts inland, runs out over the bay. */
    start: { x: sx - dir.x * 14, z: sz - dir.z * 14 },
    end: { x: sx + dir.x * 34, z: sz + dir.z * 34 },
    halfW: 3.2,
    deck: 1.25,
  };
})();

/** Career road: plaza → marina, the experience gates stand along it. */
export const CAREER_ROAD = {
  from: { x: 0, z: 44 },
  to: { x: MARINA.start.x, z: MARINA.start.z },
};

export interface Ramp {
  x: number;
  z: number;
  yaw: number;
  length: number;
  width: number;
  height: number;
}

/** Wedges you can launch off. Height rises along the ramp's local +Z. */
export const RAMPS: Ramp[] = [
  { x: 22, z: 2, yaw: Math.PI / 2, length: 12, width: 7, height: 2.6 },
  { x: -70, z: -20, yaw: -2.3, length: 14, width: 8, height: 3.4 },
  { x: 152, z: 128, yaw: 0, length: 16, width: 10, height: 3.8 },
  { x: 62, z: 70, yaw: 0.9, length: 11, width: 7, height: 2.2 },
];

interface Flat {
  x: number;
  z: number;
  r: number;
  falloff: number;
  h: number;
}

/* ---------------------------------------------------------------- height */

function rawHeight(x: number, z: number) {
  const r = Math.hypot(x, z);
  const theta = Math.atan2(z, x);
  const d = coastRadius(theta) - r; // metres inland (negative = at sea)

  if (d < 0) {
    // Continental shelf: a gentle slope, then deep water.
    return Math.max(-11, d * 0.16) + (fbm(x * 0.02, z * 0.02, 2) - 0.5) * 1.2 * smooth(-30, 0, d);
  }

  let h = 2.7 * smooth(-1, 30, d);
  h += (fbm(x * 0.011 + 3.1, z * 0.011 - 1.7) - 0.5) * 4.2 * smooth(12, 60, d);

  const mx = x - MOUNTAIN.x;
  const mz = z - MOUNTAIN.z;
  const mountain = Math.exp(-(mx * mx + mz * mz) / (2 * MOUNTAIN.sigma * MOUNTAIN.sigma));
  h += MOUNTAIN.height * mountain * (0.78 + 0.42 * fbm(x * 0.03, z * 0.03, 3));

  const ex = x - EAST_HILL.x;
  const ez = z - EAST_HILL.z;
  h += EAST_HILL.height * Math.exp(-(ex * ex + ez * ez) / (2 * EAST_HILL.sigma * EAST_HILL.sigma)) * (0.8 + 0.3 * fbm(x * 0.04, z * 0.04, 2));

  // Hills must meet the sea as cliffs, not float off it.
  return h * smooth(-2, 10, d) + Math.min(0, d);
}

const SUMMIT_H = rawHeight(MOUNTAIN.x, MOUNTAIN.z);

const FLATS: Flat[] = [
  { ...ZONES.plaza, falloff: 26, h: 2.6 },
  { x: ZONES.about.x, z: ZONES.about.z, r: 14, falloff: 14, h: 2.6 },
  { x: ZONES.resume.x, z: ZONES.resume.z, r: 16, falloff: 14, h: 2.6 },
  { x: ZONES.skills.x, z: ZONES.skills.z, r: 30, falloff: 22, h: rawHeight(ZONES.skills.x, ZONES.skills.z) },
  { x: ZONES.projects.x, z: ZONES.projects.z, r: 34, falloff: 22, h: rawHeight(ZONES.projects.x, ZONES.projects.z) },
  { x: ZONES.bowling.x, z: ZONES.bowling.z, r: 22, falloff: 16, h: rawHeight(ZONES.bowling.x, ZONES.bowling.z) },
  { x: ZONES.hangar.x, z: ZONES.hangar.z, r: 22, falloff: 14, h: RUNWAY.height },
  { x: MOUNTAIN.x, z: MOUNTAIN.z, r: 11, falloff: 9, h: SUMMIT_H },
  { x: LIGHTHOUSE.x, z: LIGHTHOUSE.z, r: 10, falloff: 10, h: Math.max(2.2, rawHeight(LIGHTHOUSE.x, LIGHTHOUSE.z)) },
];

export const SUMMIT = { x: MOUNTAIN.x, z: MOUNTAIN.z, y: SUMMIT_H };

/** Natural ground (terrain only): what the terrain mesh renders. */
export function terrainAt(x: number, z: number) {
  let h = rawHeight(x, z);

  for (const f of FLATS) {
    const d = Math.hypot(x - f.x, z - f.z);
    if (d < f.r + f.falloff) h = lerp(h, f.h, 1 - smooth(f.r, f.r + f.falloff, d));
  }

  // Runway strip with a soft shoulder.
  const rx = Math.abs(x - RUNWAY.x) - RUNWAY.halfW - 6;
  const rz = Math.abs(z - RUNWAY.z) - RUNWAY.halfL - 10;
  const outside = Math.hypot(Math.max(rx, 0), Math.max(rz, 0)) + Math.min(Math.max(rx, rz), 0);
  if (outside < 26) h = lerp(h, RUNWAY.height, 1 - smooth(0, 26, outside));

  return h;
}

/** Height of a ramp at (x, z), or -Infinity when outside it. */
export function rampAt(ramp: Ramp, x: number, z: number) {
  const dx = x - ramp.x;
  const dz = z - ramp.z;
  const c = Math.cos(ramp.yaw);
  const s = Math.sin(ramp.yaw);
  // local coordinates (ramp forward = +Z rotated by yaw)
  const lx = dx * c - dz * s;
  const lz = dx * s + dz * c;
  if (Math.abs(lx) > ramp.width / 2 || Math.abs(lz) > ramp.length / 2) return -Infinity;
  const t = (lz + ramp.length / 2) / ramp.length;
  return ramp.height * t;
}

export function dockAt(x: number, z: number) {
  const m = MARINA;
  const dx = x - m.start.x;
  const dz = z - m.start.z;
  const along = dx * m.dir.x + dz * m.dir.z;
  const across = -dx * m.dir.z + dz * m.dir.x;
  const len = Math.hypot(m.end.x - m.start.x, m.end.z - m.start.z);
  if (along < 0 || along > len || Math.abs(across) > m.halfW) return -Infinity;
  return m.deck;
}

/**
 * Drivable surface: terrain plus ramps and the dock. This is what ground
 * vehicles stand on; `terrainAt` is what gets rendered as the landscape.
 */
export function groundAt(x: number, z: number) {
  let h = terrainAt(x, z);
  for (const ramp of RAMPS) {
    const rh = rampAt(ramp, x, z);
    if (rh > -Infinity) h = Math.max(h, terrainAt(ramp.x, ramp.z) + rh);
  }
  const dock = dockAt(x, z);
  if (dock > h) h = dock;
  return h;
}

/** Surface normal of the drivable ground, by central differences. */
export function groundNormal(x: number, z: number, e = 0.9, out = { x: 0, y: 1, z: 0 }) {
  const hl = groundAt(x - e, z);
  const hr = groundAt(x + e, z);
  const hd = groundAt(x, z - e);
  const hu = groundAt(x, z + e);
  const nx = hl - hr;
  const nz = hd - hu;
  const ny = 2 * e;
  const len = Math.hypot(nx, ny, nz);
  out.x = nx / len;
  out.y = ny / len;
  out.z = nz / len;
  return out;
}

/* ------------------------------------------------------------------ water */

/**
 * Gentle swell, shared by the water shader and boat buoyancy. Keep the GLSL
 * copy in Water.tsx in sync with this function.
 */
export function waveAt(x: number, z: number, t: number) {
  return (
    Math.sin(x * 0.07 + t * 0.9) * 0.22 +
    Math.sin(z * 0.09 - t * 1.1 + x * 0.03) * 0.18 +
    Math.sin((x + z) * 0.16 + t * 1.7) * 0.07
  );
}

/* ------------------------------------------------------------------ roads */

export interface Road {
  id: string;
  points: [number, number][];
  width: number;
  closed?: boolean;
}

function ring(radius: number, segments: number): [number, number][] {
  const pts: [number, number][] = [];
  for (let i = 0; i < segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    // a slightly squashed ring reads as a real road, not a compass circle
    pts.push([Math.cos(a) * radius * 1.06, Math.sin(a) * radius * 0.94]);
  }
  return pts;
}

export const ROADS: Road[] = [
  { id: 'ring', points: ring(104, 72), width: 9, closed: true },
  {
    id: 'east',
    points: [
      [34, 0],
      [70, 4],
      [110, 0],
      [RUNWAY.x - RUNWAY.halfW - 4, -4],
    ],
    width: 9,
  },
  {
    id: 'career',
    points: [
      [CAREER_ROAD.from.x, CAREER_ROAD.from.z],
      [lerp(CAREER_ROAD.from.x, CAREER_ROAD.to.x, 0.33) + 6, lerp(CAREER_ROAD.from.z, CAREER_ROAD.to.z, 0.33)],
      [lerp(CAREER_ROAD.from.x, CAREER_ROAD.to.x, 0.66) - 5, lerp(CAREER_ROAD.from.z, CAREER_ROAD.to.z, 0.66)],
      [CAREER_ROAD.to.x, CAREER_ROAD.to.z],
    ],
    width: 9,
  },
  {
    id: 'north-west',
    points: [
      [-26, -36],
      [-50, -58],
      [ZONES.projects.x + 22, ZONES.projects.z + 20],
    ],
    width: 8,
  },
  {
    id: 'west',
    points: [
      [-44, 4],
      [-80, 14],
      [ZONES.skills.x + 26, ZONES.skills.z],
    ],
    width: 8,
  },
  {
    id: 'mountain',
    points: [
      [-70, -104],
      [-96, -132],
      [-92, -168],
      [-80, -190],
      [MOUNTAIN.x - 8, MOUNTAIN.z - 8],
    ],
    width: 7,
  },
];

/** Distance from (x, z) to the nearest road centreline. */
export function roadDistance(x: number, z: number) {
  let best = Infinity;
  for (const road of ROADS) {
    const n = road.points.length;
    const last = road.closed ? n : n - 1;
    for (let i = 0; i < last; i++) {
      const [ax, az] = road.points[i];
      const [bx, bz] = road.points[(i + 1) % n];
      const abx = bx - ax;
      const abz = bz - az;
      const t = Math.max(0, Math.min(1, ((x - ax) * abx + (z - az) * abz) / (abx * abx + abz * abz)));
      const d = Math.hypot(x - (ax + abx * t), z - (az + abz * t)) - road.width / 2;
      if (d < best) best = d;
    }
  }
  return best;
}
