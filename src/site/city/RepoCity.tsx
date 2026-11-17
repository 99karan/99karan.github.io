import { Component, lazy, Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { chapters } from '../content';
import { fallback, GITHUB_USER, languageShares, loadRepos, relativeTime, stackLabel, langColor, type Repo } from '../github';
import { finePointer, reduceMotion, useInView } from '../hooks';
import { Xray } from '../Xray';
import { planCity, type Building } from './plan';

const CityCanvas = lazy(() => import('./CityCanvas'));

class GLBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

function webglAvailable(): boolean {
  try {
    const c = document.createElement('canvas');
    return Boolean(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

/** No WebGL: the same city as a flat skyline. */
function FlatSkyline({ buildings, onSelect, selected }: { buildings: Building[]; onSelect: (n: string) => void; selected: string | null }) {
  const max = Math.max(...buildings.map((b) => b.height));
  const order = [...buildings].sort((a, b) => a.x - b.x || a.z - b.z);
  return (
    <svg className="city-flat" viewBox={`0 0 ${order.length * 60 + 20} 220`} role="img" aria-label="Skyline of repositories">
      <line x1="0" x2={order.length * 60 + 20} y1="200" y2="200" stroke="currentColor" strokeOpacity=".25" />
      {order.map((b, i) => {
        let y = 200;
        return (
          <g key={b.repo.name} onClick={() => onSelect(b.repo.name)} style={{ cursor: 'pointer' }} opacity={selected && selected !== b.repo.name ? 0.4 : 1}>
            {b.tiers.map((t) => {
              const h = (t.height / max) * 170;
              const w = (t.width / b.width) * 40;
              y -= h;
              return <rect key={t.lang} x={20 + i * 60 + (40 - w) / 2} y={y} width={w} height={h} fill={t.color} fillOpacity=".75" />;
            })}
          </g>
        );
      })}
    </svg>
  );
}

function LangBar({ repo }: { repo: Repo }) {
  const shares = languageShares(repo);
  return (
    <div className="langbar" aria-label="Languages">
      <div className="langbar__track">
        {shares.map(([l, s]) => (
          <span key={l} style={{ flexGrow: s, background: langColor(l) }} title={`${l} ${(s * 100).toFixed(1)}%`} />
        ))}
      </div>
      <ul className="langbar__keys">
        {shares.slice(0, 4).map(([l, s]) => (
          <li key={l}>
            <span style={{ background: langColor(l) }} />
            {l} <em>{(s * 100).toFixed(0)}%</em>
          </li>
        ))}
      </ul>
    </div>
  );
}

function RepoCard({ b, onClose }: { b: Building; onClose: () => void }) {
  const r = b.repo;
  const chapter = chapters.find((c) => c.repo === r.name);
  const text = r.description || r.summary || 'No description yet.';
  return (
    <div className="city-card" role="dialog" aria-label={r.name}>
      <button type="button" className="city-card__close" onClick={onClose} aria-label="Close">
        ×
      </button>
      <p className="city-card__kicker">
        <span style={{ background: b.color }} />
        {stackLabel(r)}
        {r.fork && <em>fork</em>}
        {b.recent && <em className="is-hot">active</em>}
      </p>
      <h3 className="city-card__title">{r.name}</h3>
      <p className="city-card__text">{text}</p>
      <dl className="city-card__stats">
        <div>
          <dt>Floors</dt>
          <dd>{r.commits}</dd>
        </div>
        <div>
          <dt>Tiers</dt>
          <dd>{b.tiers.length}</dd>
        </div>
        <div>
          <dt>Size</dt>
          <dd>{r.size >= 1024 ? `${(r.size / 1024).toFixed(1)} MB` : `${r.size} KB`}</dd>
        </div>
        <div>
          <dt>Pushed</dt>
          <dd>{relativeTime(r.pushedAt)}</dd>
        </div>
      </dl>
      <LangBar repo={r} />
      <div className="city-card__actions">
        <a className="btn btn--solid btn--sm" href={r.url} target="_blank" rel="noreferrer">
          Open on GitHub ↗
        </a>
        {chapter && (
          <a className="btn btn--sm" href={`#${chapter.id}`}>
            Read the case study
          </a>
        )}
        {r.homepage && (
          <a className="btn btn--sm" href={r.homepage} target="_blank" rel="noreferrer">
            Live ↗
          </a>
        )}
      </div>
    </div>
  );
}

export function RepoCity() {
  const section = useRef<HTMLElement>(null);
  const near = useInView(section, '300px');
  const visible = useInView(section, '0px');
  const [mounted, setMounted] = useState(false);
  const [started, setStarted] = useState(false);
  const [repos, setRepos] = useState<Repo[]>(fallback.repos);
  const [live, setLive] = useState(false);
  const [hovered, setHovered] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [gl] = useState(webglAvailable);
  const reduce = useMemo(reduceMotion, []);
  const fine = useMemo(finePointer, []);
  const high = useMemo(() => fine && (navigator.hardwareConcurrency || 4) >= 6 && window.innerWidth > 860, [fine]);

  // Mount the scene shortly before it scrolls in; keep it once mounted.
  useEffect(() => {
    if (near) setMounted(true);
  }, [near]);
  useEffect(() => {
    if (visible) setStarted(true);
  }, [visible]);

  // Live data from GitHub, with the bundled snapshot as the floor.
  useEffect(() => {
    if (!mounted) return;
    const ac = new AbortController();
    loadRepos(ac.signal)
      .then((r) => {
        if (r.length) {
          setRepos(r);
          setLive(true);
        }
      })
      .catch(() => {
        /* keep the snapshot */
      });
    return () => ac.abort();
  }, [mounted]);

  const buildings = useMemo(() => planCity(repos), [repos]);
  const totals = useMemo(() => {
    const langs = new Set<string>();
    repos.forEach((r) => languageShares(r).forEach(([l]) => langs.add(l)));
    const latest = repos.reduce((m, r) => (r.pushedAt > m ? r.pushedAt : m), '');
    return { repos: repos.length, commits: repos.reduce((s, r) => s + r.commits, 0), langs: langs.size, latest };
  }, [repos]);

  const focusName = selected ?? hovered;
  const focus = buildings.find((b) => b.repo.name === focusName) ?? null;

  // Escape closes the card.
  useEffect(() => {
    if (!selected) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setSelected(null);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selected]);

  return (
    <section className="city" id="city" ref={section} aria-labelledby="city-title">
      <div className="wrap">
        <div className="city__head">
          <Xray
            bone={`source: api.github.com/users/${GITHUB_USER}
floors: commits
setbacks: languages, by share
colour: primary language
beacon: pushed in the last 45 days`}
          >
            <p className="eyebrow">Repo City</p>
            <h2 className="section-title" id="city-title">
              Every public repo is a building.
            </h2>
            <p className="section-lead">
              One floor per commit. Each setback is a language, as tall as its share of the code. A blinking beacon means I pushed to it recently. The city
              grows every time I ship.
            </p>
          </Xray>
          <dl className="city__totals">
            <div>
              <dt>Buildings</dt>
              <dd>{totals.repos}</dd>
            </div>
            <div>
              <dt>Floors</dt>
              <dd>{totals.commits}</dd>
            </div>
            <div>
              <dt>Languages</dt>
              <dd>{totals.langs}</dd>
            </div>
            <div>
              <dt>Last push</dt>
              <dd>{totals.latest ? relativeTime(totals.latest) : '—'}</dd>
            </div>
          </dl>
        </div>

        <div className="city__grid">
          <div className={`city__view ${selected ? 'has-card' : ''}`}>
            {gl ? (
              <GLBoundary fallback={<FlatSkyline buildings={buildings} onSelect={setSelected} selected={selected} />}>
                {mounted && (
                  <Suspense fallback={<div className="city__loading">Laying out streets…</div>}>
                    <CityCanvas
                      visible={visible}
                      onMiss={() => setSelected(null)}
                      buildings={buildings}
                      hovered={hovered}
                      selected={selected}
                      onHover={setHovered}
                      onSelect={setSelected}
                      started={started}
                      high={high}
                      interactive={fine}
                      reduce={reduce}
                    />
                  </Suspense>
                )}
              </GLBoundary>
            ) : (
              <FlatSkyline buildings={buildings} onSelect={setSelected} selected={selected} />
            )}
            <p className="city__hint">{fine ? 'Drag to orbit · click a building' : 'Tap a building or pick one from the list'}</p>
            <p className="city__source">
              <span className={`pulse ${live ? '' : 'pulse--off'}`} aria-hidden="true" />
              {live ? 'Live from GitHub' : `Snapshot · ${new Date(fallback.fetchedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`}
            </p>
            {focus && selected && <RepoCard b={focus} onClose={() => setSelected(null)} />}
            {focus && !selected && (
              <div className="city-peek" aria-hidden="true">
                <strong>{focus.repo.name}</strong>
                <span>
                  {focus.repo.commits} floors · {stackLabel(focus.repo)} · {relativeTime(focus.repo.pushedAt)}
                </span>
              </div>
            )}
          </div>

          <ol className="city__list" aria-label="Repositories">
            {buildings.map((b) => (
              <li key={b.repo.name}>
                <button
                  type="button"
                  className={`city-row ${focusName === b.repo.name ? 'is-active' : ''}`}
                  aria-pressed={selected === b.repo.name}
                  onPointerEnter={() => setHovered(b.repo.name)}
                  onPointerLeave={() => setHovered(null)}
                  onFocus={() => setHovered(b.repo.name)}
                  onBlur={() => setHovered(null)}
                  onClick={() => setSelected(selected === b.repo.name ? null : b.repo.name)}
                >
                  <span className="city-row__swatch" aria-hidden="true">
                    {[...b.tiers].reverse().map((t) => (
                      <span key={t.lang} style={{ background: t.color, flexGrow: t.floors, width: `${(t.width / b.width) * 100}%` }} />
                    ))}
                  </span>
                  <span className="city-row__name">{b.repo.name}</span>
                  <span className="city-row__meta">
                    {stackLabel(b.repo)} · {b.repo.commits} {b.repo.commits === 1 ? 'floor' : 'floors'}
                    {b.repo.fork ? ' · fork' : ''}
                  </span>
                  {b.recent && <span className="city-row__beacon" title="Pushed in the last 45 days" />}
                </button>
              </li>
            ))}
            <li>
              <a className="city-row city-row--more" href={`https://github.com/${GITHUB_USER}`} target="_blank" rel="noreferrer">
                <span className="city-row__name">github.com/{GITHUB_USER}</span>
                <span className="city-row__meta">The whole map ↗</span>
              </a>
            </li>
          </ol>
        </div>
      </div>
    </section>
  );
}
