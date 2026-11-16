/**
 * Where everything stands. Pure data, computed once at import, plus the
 * static colliders for it — so renderers, physics, triggers and the minimap
 * all agree on one layout.
 */
import { milestones, projects, skills } from '../../data/portfolio';
import { addBox, addCircle, collide } from './colliders';
import {
  CAREER_ROAD,
  coastRadius,
  fbm,
  groundAt,
  LIGHTHOUSE,
  MARINA,
  MOUNTAIN,
  RAMPS,
  rng,
  roadDistance,
  RUNWAY,
  SPAWN,
  SUMMIT,
  terrainAt,
  WATER_LEVEL,
  ZONES,
} from './map';

export interface Placed {
  x: number;
  z: number;
  y: number;
  yaw: number;
}

const at = (x: number, z: number, yaw = 0): Placed => ({ x, z, y: terrainAt(x, z), yaw });
const faceTo = (from: { x: number; z: number }, to: { x: number; z: number }) => Math.atan2(to.x - from.x, to.z - from.z);

/* --------------------------------------------------------------- zones */

export type ZoneKind = 'about' | 'skills' | 'project' | 'milestone' | 'contact' | 'resume';

export interface Zone {
  id: string;
  kind: ZoneKind;
  x: number;
  z: number;
  r: number;
  title: string;
  subtitle: string;
  /** Project / milestone id. */
  ref?: string;
}

export const zones: Zone[] = [];

/* ------------------------------------------------------------- buildings */

export const aboutPavilion = at(ZONES.about.x, ZONES.about.z, faceTo(ZONES.about, { x: 0, z: 0 }));
export const resumeHQ = at(ZONES.resume.x, ZONES.resume.z, faceTo(ZONES.resume, { x: 0, z: 0 }));
export const lighthouse = at(LIGHTHOUSE.x, LIGHTHOUSE.z);
export const hangar = { ...at(ZONES.hangar.x, ZONES.hangar.z, Math.PI / 2), w: 24, d: 20, h: 10 };
export const tower = at(ZONES.hangar.x + 2, ZONES.hangar.z - 30);
export const helipads = [
  { ...at(RUNWAY.x - 30, RUNWAY.z + 46), home: true },
  { x: SUMMIT.x, z: SUMMIT.z, y: SUMMIT.y, yaw: 0, home: false },
];

// About: an open pavilion you can drive under (pillars only).
for (let i = 0; i < 6; i++) {
  const a = (i / 6) * Math.PI * 2 + 0.3;
  addCircle(aboutPavilion.x + Math.cos(a) * 7, aboutPavilion.z + Math.sin(a) * 7, 0.35, aboutPavilion.y + 6);
}
zones.push({ id: 'about', kind: 'about', x: aboutPavilion.x, z: aboutPavilion.z, r: 8, title: 'About me', subtitle: 'Who I am and how I work' });

// Resume HQ: a building with the giant page standing in front.
{
  const r = resumeHQ;
  const back = 9;
  const bx = r.x - Math.sin(r.yaw) * back;
  const bz = r.z - Math.cos(r.yaw) * back;
  addBox(bx, bz, 8, 5, r.yaw, r.y + 9);
  zones.push({ id: 'resume', kind: 'resume', x: r.x, z: r.z, r: 7, title: 'Resume', subtitle: 'Read it here or download the PDF' });
}

// Skills: monoliths in a ring.
export const monoliths = skills.map((skill, i) => {
  const a = (i / skills.length) * Math.PI * 2;
  const x = ZONES.skills.x + Math.cos(a) * 19;
  const z = ZONES.skills.z + Math.sin(a) * 19;
  const h = 5 + (2 - skill.ring) * 1.6;
  addBox(x, z, 1.1, 0.5, faceTo({ x, z }, ZONES.skills), terrainAt(x, z) + h);
  return { ...at(x, z, faceTo({ x, z }, ZONES.skills)), skill, h };
});
zones.push({ id: 'skills', kind: 'skills', x: ZONES.skills.x, z: ZONES.skills.z, r: 9, title: 'Skills', subtitle: 'The toolkit, ring by ring' });

// Projects: billboards on an arc, facing the approach road.
export const billboards = projects.map((project, i) => {
  const n = projects.length;
  const a = -Math.PI * 0.95 + (i / Math.max(1, n - 1)) * Math.PI * 0.75;
  const x = ZONES.projects.x + Math.cos(a) * 22;
  const z = ZONES.projects.z + Math.sin(a) * 22;
  const yaw = faceTo({ x, z }, ZONES.projects);
  const p = at(x, z, yaw);
  // Two posts; drive right under the screen.
  for (const s of [-1, 1]) {
    addCircle(x + Math.cos(yaw) * 5 * s, z - Math.sin(yaw) * 5 * s, 0.45, p.y + 11);
  }
  const fx = x + Math.sin(yaw) * 9;
  const fz = z + Math.cos(yaw) * 9;
  zones.push({
    id: `project-${project.id}`,
    kind: 'project',
    x: fx,
    z: fz,
    r: 6.5,
    title: project.title,
    subtitle: project.tagline,
    ref: project.id,
  });
  return { ...p, project, pad: { x: fx, z: fz } };
});

// Experience: gates across the career road.
export const gates = milestones.map((m, i) => {
  const t = (i + 0.7) / (milestones.length + 0.6);
  const x = CAREER_ROAD.from.x + (CAREER_ROAD.to.x - CAREER_ROAD.from.x) * t;
  const z = CAREER_ROAD.from.z + (CAREER_ROAD.to.z - CAREER_ROAD.from.z) * t;
  // Road wiggles slightly; centre each gate on the actual road by searching sideways.
  const yaw = faceTo(CAREER_ROAD.from, CAREER_ROAD.to);
  let best = { x, z, d: Infinity };
  for (let s = -10; s <= 10; s += 0.5) {
    const cx = x + Math.cos(yaw) * s;
    const cz = z - Math.sin(yaw) * s;
    const d = roadDistance(cx, cz);
    if (d < best.d) best = { x: cx, z: cz, d };
  }
  for (const s of [-1, 1]) addCircle(best.x + Math.cos(yaw) * 6.8 * s, best.z - Math.sin(yaw) * 6.8 * s, 0.7, terrainAt(best.x, best.z) + 8);
  zones.push({ id: `milestone-${m.id}`, kind: 'milestone', x: best.x, z: best.z, r: 7.5, title: m.role, subtitle: m.period, ref: m.id });
  return { ...at(best.x, best.z, yaw), milestone: m };
});

// Contact: the lighthouse.
addCircle(lighthouse.x, lighthouse.z, 3.1, lighthouse.y + 26);
{
  const toCentre = faceTo(lighthouse, { x: 0, z: 0 });
  const zx = lighthouse.x + Math.sin(toCentre) * 9;
  const zz = lighthouse.z + Math.cos(toCentre) * 9;
  zones.push({ id: 'contact', kind: 'contact', x: zx, z: zz, r: 7, title: 'Contact', subtitle: "Let's build something" });
}
export const contactPad = zones[zones.length - 1];

// Hangar: open to the runway (east), walls on three sides.
{
  const h = hangar;
  const top = h.y + h.h;
  addBox(h.x, h.z - h.d / 2, h.w / 2, 0.4, 0, top); // north wall
  addBox(h.x, h.z + h.d / 2, h.w / 2, 0.4, 0, top); // south wall
  addBox(h.x - h.w / 2, h.z, 0.4, h.d / 2, 0, top); // back wall (west)
  addCircle(tower.x, tower.z, 2.6, tower.y + 17);
}

// Marina: the dock stops boats but not cars on its deck.
export const dock = (() => {
  const m = MARINA;
  const len = Math.hypot(m.end.x - m.start.x, m.end.z - m.start.z);
  const yaw = Math.atan2(m.dir.x, m.dir.z);
  const waterStart = 14;
  const wl = len - waterStart;
  const cx = m.start.x + m.dir.x * (waterStart + wl / 2);
  const cz = m.start.z + m.dir.z * (waterStart + wl / 2);
  addBox(cx, cz, m.halfW, wl / 2, yaw, m.deck - 0.3);
  return { len, yaw };
})();
export const boathouse = (() => {
  const m = MARINA;
  const side = { x: -m.dir.z, z: m.dir.x };
  const x = m.start.x + side.x * 12 - m.dir.x * 4;
  const z = m.start.z + side.z * 12 - m.dir.z * 4;
  const p = at(x, z, dock.yaw);
  addBox(x, z, 4, 5, dock.yaw, p.y + 6);
  return p;
})();

/* ----------------------------------------------------------------- spawns */

export const SPAWNS = {
  car: { x: SPAWN.x, z: SPAWN.z, yaw: SPAWN.yaw },
  bike: { x: SPAWN.x + 5, z: SPAWN.z + 2, yaw: SPAWN.yaw },
  plane: { x: RUNWAY.x, z: RUNWAY.z + RUNWAY.halfL - 12, yaw: Math.PI },
  heli: { x: helipads[0].x, z: helipads[0].z, yaw: Math.PI },
  boat: (() => {
    const m = MARINA;
    return { x: m.end.x - m.dir.z * 6.5 - m.dir.x * 4, z: m.end.z + m.dir.x * 6.5 - m.dir.z * 4, yaw: Math.atan2(m.dir.x, m.dir.z) };
  })(),
};

/* ----------------------------------------------------- skill collectibles */

export interface Token {
  skill: string;
  x: number;
  z: number;
  y: number;
  hint: string;
}

const tokenSpots: [number, number, number | null, string][] = [
  [0, -6, null, 'Right in front of you'],
  [36, 2, 8.4, 'Jump the plaza ramp'],
  [ZONES.skills.x, ZONES.skills.z, null, 'Centre of the skills ring'],
  [SUMMIT.x, SUMMIT.z, SUMMIT.y + 2.2, 'The mountain-top helipad'],
  [ZONES.projects.x, ZONES.projects.z, null, 'Under the project billboards'],
  [MARINA.start.x - MARINA.dir.x * 8, MARINA.start.z - MARINA.dir.z * 8, null, 'End of the career road'],
  [LIGHTHOUSE.x + 42, LIGHTHOUSE.z + 40, WATER_LEVEL + 1.8, 'Out at sea, off the lighthouse'],
  [RUNWAY.x, RUNWAY.z - 230, 80, 'High above the runway — fly'],
  [LIGHTHOUSE.x, LIGHTHOUSE.z, lighthouse.y + 29, 'Top of the lighthouse'],
  [ZONES.hangar.x, ZONES.hangar.z, null, 'Inside the hangar'],
];

export const tokens: Token[] = skills.map((s, i) => {
  const [x, z, y, hint] = tokenSpots[i % tokenSpots.length];
  return { skill: s.name, x, z, y: y ?? groundAt(x, z) + 1.6, hint };
});

/* ------------------------------------------------------------------ scatter */

function isClear(x: number, z: number, pad: number) {
  if (Math.hypot(x - ZONES.plaza.x, z - ZONES.plaza.z) < ZONES.plaza.r + 6) return false;
  if (Math.abs(x - RUNWAY.x) < RUNWAY.halfW + 22 && Math.abs(z - RUNWAY.z) < RUNWAY.halfL + 30) return false;
  for (const zone of zones) if (Math.hypot(x - zone.x, z - zone.z) < zone.r + 10) return false;
  for (const key of ['skills', 'projects', 'bowling', 'hangar'] as const) {
    if (Math.hypot(x - ZONES[key].x, z - ZONES[key].z) < 34) return false;
  }
  for (const ramp of RAMPS) if (Math.hypot(x - ramp.x, z - ramp.z) < 16) return false;
  for (const pad of helipads) if (Math.hypot(x - pad.x, z - pad.z) < 14) return false;
  if (Math.hypot(x - MARINA.start.x, z - MARINA.start.z) < 26) return false;
  if (Math.hypot(x - lighthouse.x, z - lighthouse.z) < 16) return false;
  if (Math.hypot(x - SPAWNS.bike.x, z - SPAWNS.bike.z) < 12) return false;
  if (roadDistance(x, z) < pad) return false;
  if (collide(x, z, terrainAt(x, z), 2.5).hit) return false;
  return true;
}

export const houses = (() => {
  const out: (Placed & { w: number; d: number; h: number; roof: string; wall: string })[] = [];
  const r = rng(91);
  const roofs = ['#b5523b', '#3d5a80', '#5c6b73', '#8c5e3c', '#2f6f5e'];
  const walls = ['#f2ede4', '#e8e1d3', '#f5f0e8', '#dfe5e8'];
  let guard = 0;
  while (out.length < 14 && guard++ < 4000) {
    const a = r() * Math.PI * 2;
    const rad = 60 + r() * 120;
    const x = Math.cos(a) * rad;
    const z = Math.sin(a) * rad;
    const h = terrainAt(x, z);
    const rd = roadDistance(x, z);
    if (h < 2 || h > 14 || rd < 7 || rd > 18) continue;
    if (!isClear(x, z, 7)) continue;
    if (out.some((o) => Math.hypot(o.x - x, o.z - z) < 18)) continue;
    const w = 6 + r() * 3;
    const d = 5 + r() * 3;
    // Face the nearest road roughly: sample the gradient of road distance.
    const gx = roadDistance(x + 1, z) - roadDistance(x - 1, z);
    const gz = roadDistance(x, z + 1) - roadDistance(x, z - 1);
    const yaw = Math.atan2(-gx, -gz);
    const ht = 4 + r() * 2.5;
    addBox(x, z, w / 2, d / 2, yaw, h + ht + 2);
    out.push({ x, z, y: h, yaw, w, d, h: ht, roof: roofs[out.length % roofs.length], wall: walls[out.length % walls.length] });
  }
  return out;
})();

export interface TreeSpot {
  x: number;
  z: number;
  y: number;
  s: number;
  kind: 0 | 1 | 2; // pine, broadleaf, palm
  rot: number;
}

let treeCache: TreeSpot[] | null = null;

/** Trees for this session. Colliders are registered once, for exactly the trees drawn. */
export function scatterTrees(count: number): TreeSpot[] {
  if (treeCache) return treeCache;
  const out: TreeSpot[] = [];
  const r = rng(1234);
  let guard = 0;
  while (out.length < count && guard++ < count * 40) {
    const a = r() * Math.PI * 2;
    const rad = Math.sqrt(r()) * 240;
    const x = Math.cos(a) * rad;
    const z = Math.sin(a) * rad;
    const h = terrainAt(x, z);
    if (h < 0.9 || h > 48) continue;
    const inland = coastRadius(Math.atan2(z, x)) - Math.hypot(x, z);
    const beach = h < 2.2 && inland < 26;
    // Forest density follows noise, so trees cluster into groves.
    const density = fbm(x * 0.02 + 11, z * 0.02 - 5, 3);
    if (!beach && density < 0.47 && r() > 0.12) continue;
    if (!isClear(x, z, 3.5)) continue;
    const slope = Math.abs(terrainAt(x + 1.5, z) - terrainAt(x - 1.5, z)) + Math.abs(terrainAt(x, z + 1.5) - terrainAt(x, z - 1.5));
    if (slope > 2.4) continue;
    const nearMountain = Math.hypot(x - MOUNTAIN.x, z - MOUNTAIN.z) < 75;
    const kind: 0 | 1 | 2 = beach ? 2 : nearMountain || h > 12 ? 0 : r() < 0.35 ? 0 : 1;
    const s = 0.8 + r() * 0.6;
    out.push({ x, z, y: h, s, kind, rot: r() * Math.PI * 2 });
  }
  for (const t of out) addCircle(t.x, t.z, 0.45 * t.s + 0.15, t.y + 6 * t.s);
  treeCache = out;
  return out;
}

export const lamps = (() => {
  const out: Placed[] = [];
  for (let i = 0; i < 40; i++) {
    const a = (i / 40) * Math.PI * 2;
    const x = Math.cos(a) * 104 * 1.06;
    const z = Math.sin(a) * 104 * 0.94;
    const nx = Math.cos(a);
    const nz = Math.sin(a);
    const lx = x + nx * 6.2;
    const lz = z + nz * 6.2;
    if (collide(lx, lz, terrainAt(lx, lz), 1.2).hit) continue;
    addCircle(lx, lz, 0.22, terrainAt(lx, lz) + 6);
    out.push({ x: lx, z: lz, y: terrainAt(lx, lz), yaw: Math.atan2(-nx, -nz) });
  }
  return out;
})();


/* ------------------------------------------------------------ fast travel */

/** A point `back` metres from (x, z) towards the plaza, facing (x, z). */
function approach(x: number, z: number, back: number) {
  const d = Math.hypot(x, z) || 1;
  const ax = x - (x / d) * back;
  const az = z - (z / d) * back;
  return { x: ax, z: az, yaw: Math.atan2(x - ax, z - az) };
}

export const places: { id: string; label: string; note: string; go: { x: number; z: number; yaw: number } | 'plane' | 'boat' }[] = [
  { id: 'spawn', label: 'Plaza', note: 'Where you started — the giant letters', go: { x: SPAWN.x, z: SPAWN.z, yaw: SPAWN.yaw } },
  { id: 'projects', label: 'Projects', note: 'Billboard gallery', go: approach(ZONES.projects.x, ZONES.projects.z, 6) },
  { id: 'experience', label: 'Experience', note: 'Career road, gate by gate', go: { x: CAREER_ROAD.from.x, z: CAREER_ROAD.from.z, yaw: faceTo(CAREER_ROAD.from, gates[0] ?? CAREER_ROAD.to) } },
  { id: 'skills', label: 'Skills', note: 'Ring of monoliths', go: approach(ZONES.skills.x, ZONES.skills.z, 30) },
  { id: 'about', label: 'About', note: 'The pavilion', go: approach(ZONES.about.x, ZONES.about.z, 14) },
  { id: 'resume', label: 'Resume HQ', note: 'Read or download', go: approach(ZONES.resume.x, ZONES.resume.z, 14) },
  { id: 'contact', label: 'Contact', note: 'The lighthouse', go: approach(contactPad.x, contactPad.z, 12) },
  { id: 'airfield', label: 'Airfield', note: 'Take the plane up', go: 'plane' },
  { id: 'marina', label: 'Marina', note: 'Take the boat out', go: 'boat' },
];
