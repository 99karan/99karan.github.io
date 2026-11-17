import snapshot from '../data/repos.json';

/** One public repository: one building in the Repo City. */
export interface Repo {
  name: string;
  url: string;
  description: string;
  summary: string;
  language: string | null;
  languages: Record<string, number>;
  stars: number;
  forks: number;
  size: number;
  commits: number;
  fork: boolean;
  pushedAt: string;
  createdAt: string;
  homepage: string;
  topics: string[];
}

export interface RepoSnapshot {
  user: string;
  fetchedAt: string;
  repos: Repo[];
}

export const fallback = snapshot as unknown as RepoSnapshot;
export const GITHUB_USER = fallback.user;

/* GitHub's own linguist colours, so the city reads like the language bar on a repo page. */
const LANG_COLORS: Record<string, string> = {
  Dart: '#00b4ab',
  TypeScript: '#3178c6',
  JavaScript: '#f1e05a',
  'C++': '#f34b7d',
  C: '#8a8f98',
  Python: '#3572a5',
  Swift: '#f05138',
  Kotlin: '#a97bff',
  Java: '#b07219',
  Go: '#00add8',
  Rust: '#dea584',
  CSS: '#663399',
  HTML: '#e34c26',
  CMake: '#da3434',
  Ruby: '#701516',
  Shell: '#89e051',
  'Objective-C': '#438eff',
  Markdown: '#c9c4b8',
};

export function langColor(lang: string | null | undefined): string {
  return (lang && LANG_COLORS[lang]) || '#9aa3a0';
}

/**
 * A Flutter project ships platform runners (CMake, C, Ruby pods, Obj-C stubs,
 * an HTML shell) that dwarf the Dart in a young repo. Those aren't the work,
 * so they are left out of the building; real native code (Swift, Kotlin, C++) stays.
 */
const FLUTTER_SCAFFOLD = new Set(['CMake', 'C', 'Ruby', 'Objective-C', 'HTML', 'Shell', 'PureBasic']);

export function isFlutter(repo: Repo): boolean {
  return 'Dart' in repo.languages;
}

/** Languages by share, scaffolding removed, as [name, fraction] pairs. */
export function languageShares(repo: Repo): [string, number][] {
  const flutter = isFlutter(repo);
  const entries = Object.entries(repo.languages).filter(([l]) => !(flutter && FLUTTER_SCAFFOLD.has(l)));
  if (flutter) {
    // Put Dart first: it's what the app is written in, whatever the byte count of the runners.
    entries.sort(([a, x], [b, y]) => (a === 'Dart' ? -1 : b === 'Dart' ? 1 : y - x));
  } else {
    entries.sort(([, x], [, y]) => y - x);
  }
  const total = entries.reduce((s, [, n]) => s + n, 0);
  if (!total) return [[repo.language || 'Markdown', 1]];
  return entries.map(([l, n]) => [l, n / total]);
}

export function primaryLanguage(repo: Repo): string {
  return languageShares(repo)[0][0];
}

/** "Flutter" reads better than "Dart" for an app. */
export function stackLabel(repo: Repo): string {
  return isFlutter(repo) ? 'Flutter' : primaryLanguage(repo);
}

export function daysSince(iso: string): number {
  return Math.max(0, (Date.now() - new Date(iso).getTime()) / 86_400_000);
}

export function relativeTime(iso: string): string {
  const d = Math.floor(daysSince(iso));
  if (d < 1) return 'today';
  if (d < 2) return 'yesterday';
  if (d < 30) return `${d} days ago`;
  const m = Math.round(d / 30);
  if (m < 12) return `${m} month${m > 1 ? 's' : ''} ago`;
  const y = Math.round(d / 365);
  return `${y} year${y > 1 ? 's' : ''} ago`;
}

/* ------------------------------------------------------------------ */
/* Live data                                                           */
/* ------------------------------------------------------------------ */

const CACHE_KEY = `repo-city:${GITHUB_USER}`;
const CACHE_TTL = 60 * 60 * 1000; // an hour keeps a visitor far inside the 60 req/h anonymous limit

async function json<T>(url: string, signal: AbortSignal): Promise<T> {
  const res = await fetch(url, { signal, headers: { Accept: 'application/vnd.github+json' } });
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json() as Promise<T>;
}

async function commitCount(name: string, signal: AbortSignal): Promise<number> {
  const res = await fetch(`https://api.github.com/repos/${GITHUB_USER}/${name}/commits?per_page=1`, { signal });
  if (!res.ok) return 0;
  const m = /[?&]page=(\d+)>;\s*rel="last"/.exec(res.headers.get('link') || '');
  if (m) return Number(m[1]);
  const body = (await res.json()) as unknown[];
  return Array.isArray(body) ? body.length : 0;
}

interface ApiRepo {
  name: string;
  html_url: string;
  description: string | null;
  language: string | null;
  stargazers_count: number;
  forks_count: number;
  size: number;
  fork: boolean;
  private: boolean;
  archived: boolean;
  pushed_at: string;
  created_at: string;
  homepage: string | null;
  topics?: string[];
}

/**
 * The live city: every public repo, refreshed from the GitHub API at most once an hour.
 * Repos the snapshot already knows keep their README summary; anything that
 * fails falls back to the snapshot, so the city always has buildings.
 */
export async function loadRepos(signal: AbortSignal): Promise<Repo[]> {
  try {
    const cached = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null') as { at: number; repos: Repo[] } | null;
    if (cached && Date.now() - cached.at < CACHE_TTL && cached.repos.length) return cached.repos;
  } catch {
    /* no storage: just fetch */
  }

  const known = new Map(fallback.repos.map((r) => [r.name, r]));
  const list = await json<ApiRepo[]>(
    `https://api.github.com/users/${GITHUB_USER}/repos?per_page=100&type=owner&sort=pushed`,
    signal,
  );

  const repos = await Promise.all(
    list
      .filter((r) => !r.private && !r.archived)
      .map(async (r): Promise<Repo> => {
        const old = known.get(r.name);
        // Unchanged since the snapshot: no need to spend two more requests on it.
        const fresh = old && old.pushedAt === r.pushed_at;
        const [languages, commits] = fresh
          ? [old.languages, old.commits]
          : await Promise.all([
              json<Record<string, number>>(`https://api.github.com/repos/${GITHUB_USER}/${r.name}/languages`, signal).catch(
                () => old?.languages ?? {},
              ),
              commitCount(r.name, signal).catch(() => old?.commits ?? 0),
            ]);
        return {
          name: r.name,
          url: r.html_url,
          description: r.description || '',
          summary: old?.summary ?? '',
          language: r.language,
          languages,
          stars: r.stargazers_count,
          forks: r.forks_count,
          size: r.size,
          commits,
          fork: r.fork,
          pushedAt: r.pushed_at,
          createdAt: r.created_at,
          homepage: r.homepage || '',
          topics: r.topics || [],
        };
      }),
  );

  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), repos }));
  } catch {
    /* storage full or blocked */
  }
  return repos;
}
