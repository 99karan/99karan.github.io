#!/usr/bin/env node
/**
 * Snapshots the public GitHub repos that become buildings in the Repo City.
 *
 *   npm run repos
 *
 * Writes src/data/repos.json. The site also fetches live data in the browser;
 * this snapshot is what it falls back to when the API is unreachable or
 * rate-limited, and it is where README summaries come from (the browser does
 * not fetch READMEs, to stay well inside the unauthenticated rate limit).
 *
 * Set GITHUB_TOKEN to lift the rate limit (CI does this automatically).
 * Never fails the build: on any error the existing snapshot is kept.
 */
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const USER = process.env.GITHUB_USER || '99karan';
const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'data', 'repos.json');

const headers = {
  Accept: 'application/vnd.github+json',
  'User-Agent': 'portfolio-repo-city',
  ...(process.env.GITHUB_TOKEN ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {}),
};

async function gh(path) {
  const res = await fetch(`https://api.github.com${path}`, { headers });
  if (!res.ok) throw new Error(`${path} → ${res.status} ${res.statusText}`);
  return res;
}

/** Commit count without paging through history: ask for 1 per page, read the last page number. */
async function commitCount(repo) {
  try {
    const res = await gh(`/repos/${USER}/${repo}/commits?per_page=1`);
    const link = res.headers.get('link') || '';
    const m = /[?&]page=(\d+)>;\s*rel="last"/.exec(link);
    if (m) return Number(m[1]);
    const body = await res.json();
    return Array.isArray(body) ? body.length : 0;
  } catch {
    return 0; // empty repositories answer 409
  }
}

/** First real paragraph of the README: skips headings, badges, images and HTML. */
async function readmeSummary(repo) {
  try {
    const res = await fetch(`https://raw.githubusercontent.com/${USER}/${repo}/HEAD/README.md`);
    if (!res.ok) return '';
    const text = await res.text();
    const paras = text
      .split(/\n\s*\n/)
      .map((p) => p.trim())
      .filter((p) => p && !/^(#|!\[|\[!\[|<|---|\||```|[-*] \[)/.test(p));
    const first = (paras[0] || '')
      .replace(/\s+/g, ' ')
      .replace(/\*\*(.+?)\*\*/g, '$1')
      .replace(/\[(.+?)\]\(.+?\)/g, '$1')
      .replace(/`/g, '');
    return first.length > 260 ? `${first.slice(0, 257).replace(/\s+\S*$/, '')}…` : first;
  } catch {
    return '';
  }
}

async function main() {
  const list = await (await gh(`/users/${USER}/repos?per_page=100&type=owner&sort=pushed`)).json();
  const repos = [];
  for (const r of list) {
    if (r.private || r.archived) continue;
    const [languages, commits, summary] = await Promise.all([
      gh(`/repos/${USER}/${r.name}/languages`).then((x) => x.json()).catch(() => ({})),
      commitCount(r.name),
      readmeSummary(r.name),
    ]);
    repos.push({
      name: r.name,
      url: r.html_url,
      description: r.description || '',
      summary,
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
    });
  }
  const snapshot = { user: USER, fetchedAt: new Date().toISOString(), repos };
  await writeFile(OUT, `${JSON.stringify(snapshot, null, 2)}\n`);
  console.log(`repo city: ${repos.length} public repos → ${OUT}`);
}

main().catch((err) => {
  console.warn(`repo city: snapshot not refreshed (${err.message}); keeping the existing one`);
});
