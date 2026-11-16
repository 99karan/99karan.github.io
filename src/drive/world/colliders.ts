/**
 * Static obstacles the vehicles bump into: buildings, trees, posts.
 *
 * Vehicles are treated as circles on the ground plane; obstacles are circles
 * or rotated boxes with a top height, so aircraft pass over what they clear.
 * A coarse spatial hash keeps lookups cheap with hundreds of trees.
 */

interface Circle {
  kind: 'circle';
  x: number;
  z: number;
  r: number;
  top: number;
  bottom: number;
}

interface Box {
  kind: 'box';
  x: number;
  z: number;
  hx: number;
  hz: number;
  cos: number;
  sin: number;
  top: number;
  bottom: number;
}

type Shape = Circle | Box;

const CELL = 16;
const grid = new Map<string, Shape[]>();
const all: Shape[] = [];

function cellsFor(x: number, z: number, extent: number) {
  const keys: string[] = [];
  const x0 = Math.floor((x - extent) / CELL);
  const x1 = Math.floor((x + extent) / CELL);
  const z0 = Math.floor((z - extent) / CELL);
  const z1 = Math.floor((z + extent) / CELL);
  for (let i = x0; i <= x1; i++) for (let j = z0; j <= z1; j++) keys.push(`${i},${j}`);
  return keys;
}

function insert(shape: Shape, extent: number) {
  all.push(shape);
  for (const key of cellsFor(shape.x, shape.z, extent)) {
    const bucket = grid.get(key);
    if (bucket) bucket.push(shape);
    else grid.set(key, [shape]);
  }
}

export function addCircle(x: number, z: number, r: number, top: number, bottom = -50) {
  insert({ kind: 'circle', x, z, r, top, bottom }, r);
}

/** Box with half-extents hx (local X) and hz (local Z), rotated by yaw. */
export function addBox(x: number, z: number, hx: number, hz: number, yaw: number, top: number, bottom = -50) {
  insert({ kind: 'box', x, z, hx, hz, cos: Math.cos(yaw), sin: Math.sin(yaw), top, bottom }, Math.hypot(hx, hz));
}

export interface Hit {
  hit: boolean;
  /** Push-out direction (unit, XZ). */
  nx: number;
  nz: number;
  depth: number;
}

const result: Hit = { hit: false, nx: 0, nz: 0, depth: 0 };
const seen = new Set<Shape>();

/**
 * Deepest penetration of a circle (x, z, radius) at height y against the
 * obstacles. `height` is how tall the vehicle is above y.
 */
export function collide(x: number, z: number, y: number, radius: number, height = 1.5): Hit {
  result.hit = false;
  result.depth = 0;
  seen.clear();

  for (const key of cellsFor(x, z, radius)) {
    const bucket = grid.get(key);
    if (!bucket) continue;
    for (const s of bucket) {
      if (seen.has(s)) continue;
      seen.add(s);
      if (y > s.top || y + height < s.bottom) continue;

      if (s.kind === 'circle') {
        const dx = x - s.x;
        const dz = z - s.z;
        const d = Math.hypot(dx, dz);
        const depth = s.r + radius - d;
        if (depth > result.depth) {
          result.hit = true;
          result.depth = depth;
          result.nx = d > 1e-4 ? dx / d : 1;
          result.nz = d > 1e-4 ? dz / d : 0;
        }
      } else {
        // Into box space (box local +Z = world direction (sin, cos)).
        const dx = x - s.x;
        const dz = z - s.z;
        const lx = dx * s.cos - dz * s.sin;
        const lz = dx * s.sin + dz * s.cos;
        const cx = Math.max(-s.hx, Math.min(s.hx, lx));
        const cz = Math.max(-s.hz, Math.min(s.hz, lz));
        let px = lx - cx;
        let pz = lz - cz;
        let d = Math.hypot(px, pz);
        let depth: number;
        if (d < 1e-4) {
          // Centre inside the box: push out through the nearest face.
          const ex = s.hx - Math.abs(lx);
          const ez = s.hz - Math.abs(lz);
          if (ex < ez) {
            px = Math.sign(lx) || 1;
            pz = 0;
            depth = ex + radius;
          } else {
            px = 0;
            pz = Math.sign(lz) || 1;
            depth = ez + radius;
          }
          d = 1;
        } else {
          depth = radius - d;
        }
        if (depth > result.depth) {
          const ux = px / d;
          const uz = pz / d;
          // Back to world space.
          result.hit = true;
          result.depth = depth;
          result.nx = ux * s.cos + uz * s.sin;
          result.nz = -ux * s.sin + uz * s.cos;
        }
      }
    }
  }
  return result;
}

export function colliderCount() {
  return all.length;
}
