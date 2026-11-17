import { daysSince, langColor, languageShares, type Repo } from '../github';

/**
 * How a repo becomes a building:
 *   floors    = commits (one floor per commit, so the city grows as I work)
 *   setbacks  = the repo's top languages, bottom to top by share,
 *               each tier's height = that language's share of the code
 *   footprint = code size (log scale)
 *   colour    = language (GitHub's colours)
 *   beacon    = pushed in the last 45 days
 *   fork      = a dashed ring around the plot
 */
export const FLOOR = 0.5;
export const LOBBY = 0.7;
export const PLOT = 6.4;
const MAX_TIERS = 3;
const MIN_FLOORS = 3;

export interface Tier {
  lang: string;
  color: string;
  share: number;
  floors: number;
  width: number;
  /** Bottom of the tier, above the lobby. */
  y: number;
  height: number;
}

export interface Building {
  repo: Repo;
  x: number;
  z: number;
  width: number;
  tiers: Tier[];
  /** Top of the roof. */
  height: number;
  recent: boolean;
  color: string;
}

/** Square spiral of plot coordinates: centre first, then rings around it. */
function spiral(n: number): [number, number][] {
  const out: [number, number][] = [[0, 0]];
  let x = 0;
  let z = 0;
  let leg = 1;
  const dirs: [number, number][] = [
    [1, 0],
    [0, 1],
    [-1, 0],
    [0, -1],
  ];
  let d = 0;
  while (out.length < n) {
    for (let rep = 0; rep < 2 && out.length < n; rep++) {
      for (let i = 0; i < leg && out.length < n; i++) {
        x += dirs[d][0];
        z += dirs[d][1];
        out.push([x, z]);
      }
      d = (d + 1) % 4;
    }
    leg++;
  }
  return out;
}

export function planCity(repos: Repo[]): Building[] {
  // The busiest repo stands in the middle; the rest spiral out by activity.
  const sorted = [...repos].sort((a, b) => b.commits - a.commits || +new Date(b.pushedAt) - +new Date(a.pushedAt));
  const plots = spiral(sorted.length);
  // Centre the district on its own bounding box.
  const xs = plots.map((p) => p[0]);
  const zs = plots.map((p) => p[1]);
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
  const cz = (Math.min(...zs) + Math.max(...zs)) / 2;

  return sorted.map((repo, i) => {
    const floors = Math.max(MIN_FLOORS, repo.commits);
    const width = 2.3 + Math.min(1.9, Math.log10(repo.size + 1) * 0.42);

    // Top languages; anything below the cut folds into the last tier.
    let shares = languageShares(repo).filter(([, s]) => s >= 0.04);
    if (!shares.length) shares = languageShares(repo).slice(0, 1);
    shares = shares.slice(0, Math.min(MAX_TIERS, floors));
    const sum = shares.reduce((s, [, v]) => s + v, 0);

    // Hand out floors by share, at least one each, exactly `floors` in total.
    const alloc = shares.map(([, s]) => Math.max(1, Math.floor((s / sum) * floors)));
    let left = floors - alloc.reduce((a, b) => a + b, 0);
    for (let k = 0; left > 0; k = (k + 1) % alloc.length, left--) alloc[k]++;
    for (let k = alloc.length - 1; left < 0; k = (k - 1 + alloc.length) % alloc.length) {
      if (alloc[k] > 1) {
        alloc[k]--;
        left++;
      }
    }

    let y = LOBBY;
    const tiers: Tier[] = shares.map(([lang, share], t) => {
      const h = alloc[t] * FLOOR;
      const tier: Tier = {
        lang,
        color: langColor(lang),
        share: share / sum,
        floors: alloc[t],
        width: width * Math.pow(0.76, t),
        y,
        height: h,
      };
      y += h;
      return tier;
    });

    const [px, pz] = plots[i];
    return {
      repo,
      x: (px - cx) * PLOT,
      z: (pz - cz) * PLOT,
      width,
      tiers,
      height: y,
      recent: daysSince(repo.pushedAt) <= 45,
      color: tiers[0].color,
    };
  });
}

/** Half-size of the repo district, for keeping filler buildings out of it. */
export function districtExtent(buildings: Building[]): number {
  return buildings.reduce((m, b) => Math.max(m, Math.abs(b.x), Math.abs(b.z)), 0) + PLOT / 2;
}
