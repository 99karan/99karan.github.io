import { profile, skills, socials, stats } from '../../data/portfolio';
import { Sheet } from '../../components/Sheet';
import { store, useStore } from '../state';
import { places, tokens } from '../world/placements';

const CONTROLS: { group: string; rows: [string, string][] }[] = [
  {
    group: 'Everywhere',
    rows: [
      ['1 – 5', 'Car · Bike · Plane · Helicopter · Boat'],
      ['E / Enter', 'Open the place you are parked at'],
      ['R', 'Reset vehicle (flip it back on its wheels)'],
      ['N', 'Day / night'],
      ['M', 'Sound on / off'],
      ['V', 'Near / far camera'],
      ['Drag · Scroll', 'Look around · zoom'],
      ['H', 'Horn'],
      ['P', 'Change the car’s paint'],
    ],
  },
  {
    group: 'Car & bike',
    rows: [
      ['W / S', 'Throttle / brake & reverse'],
      ['A / D', 'Steer'],
      ['Shift', 'Boost (the bike wheelies)'],
      ['Space', 'Handbrake — drift'],
    ],
  },
  {
    group: 'Plane',
    rows: [
      ['W', 'On the runway: throttle up. Past 90 km/h: pull up to take off'],
      ['W / S', 'In the air: climb / dive'],
      ['A / D', 'Bank and turn'],
      ['Shift / Space', 'Full power / slow down'],
      ['Land', 'Shallow, wings level, on flat ground'],
    ],
  },
  {
    group: 'Helicopter',
    rows: [
      ['Space / C', 'Climb / descend (it holds altitude on its own)'],
      ['W / S', 'Fly forward / back'],
      ['A / D', 'Turn'],
      ['Shift', 'Fast forward flight'],
    ],
  },
  {
    group: 'Boat',
    rows: [
      ['W / S', 'Throttle / reverse'],
      ['A / D', 'Steer'],
      ['Shift', 'Boost'],
    ],
  },
];

export function DrivePanels() {
  const panel = useStore((s) => s.panel);
  const collected = useStore((s) => s.collected);
  const close = () => store.set({ panel: null });

  return (
    <>
      <Sheet open={panel === 'about'} onClose={close} label="About" eyebrow="01 — ABOUT">
        <h2>{profile.about.heading}</h2>
        <p className="sheet__tagline">{profile.tagline}</p>
        <p className="copy">{profile.about.body}</p>
        <p className="copy">{profile.about.secondary}</p>
        <ul>
          {stats.map((s) => (
            <li key={s.label}>
              <b>{s.value}</b> {s.label} — {s.note}
            </li>
          ))}
        </ul>
        <div className="sheet__actions">
          <button type="button" className="btn btn--ghost" onClick={close}>
            ← Back to the island
          </button>
        </div>
      </Sheet>

      <Sheet open={panel === 'skills'} onClose={close} label="Skills" eyebrow={`02 — SKILLS · ${collected.length}/${tokens.length} FOUND`}>
        <h2>The toolkit</h2>
        <p className="sheet__tagline">Each skill is also a gem hidden somewhere on the island.</p>
        <ul className="skill-list">
          {skills.map((s) => {
            const got = collected.includes(s.name);
            const token = tokens.find((t) => t.skill === s.name);
            return (
              <li key={s.name} data-got={got}>
                <span className="skill-list__dot" style={{ background: got ? s.accent : 'transparent', borderColor: s.accent }} />
                <div>
                  <b>{s.name}</b> — {s.detail}
                  {!got && token && <span className="skill-list__hint mono">Hint: {token.hint}</span>}
                </div>
              </li>
            );
          })}
        </ul>
        <div className="sheet__actions">
          <button type="button" className="btn btn--ghost" onClick={close}>
            ← Back to the island
          </button>
        </div>
      </Sheet>

      <Sheet open={panel === 'contact'} onClose={close} label="Contact" eyebrow="05 — CONTACT">
        <h2>{profile.contact.heading}</h2>
        <p className="sheet__tagline">{profile.contact.body}</p>
        <div className="sheet__actions" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
          {socials.map((s) => (
            <a key={s.id} className="btn" href={s.url} target={s.id === 'email' ? undefined : '_blank'} rel="noopener noreferrer">
              <span className="btn__dot" aria-hidden="true" />
              {s.label} <span className="mono" style={{ marginLeft: 'auto', opacity: 0.7 }}>{s.handle}</span>
            </a>
          ))}
          <button type="button" className="btn btn--ghost" onClick={close}>
            ← Back to the island
          </button>
        </div>
      </Sheet>

      <Sheet open={panel === 'places'} onClose={close} label="Places" eyebrow="FAST TRAVEL">
        <h2>Where to?</h2>
        <p className="sheet__tagline">Short on time? Jump straight to any part of the portfolio.</p>
        <div className="places">
          {places.map((p) => (
            <button
              key={p.id}
              type="button"
              className="places__btn"
              onClick={() => (typeof p.go === 'string' ? store.base(p.go) : store.travel(p.go.x, p.go.z, p.go.yaw))}
            >
              <b>{p.label}</b>
              <span>{p.note}</span>
            </button>
          ))}
        </div>
      </Sheet>

      <Sheet open={panel === 'help'} onClose={close} label="Controls" eyebrow="CONTROLS">
        <h2>How to drive</h2>
        {CONTROLS.map((c) => (
          <div key={c.group} className="controls-table">
            <h4 className="mono">{c.group}</h4>
            <dl>
              {c.rows.map(([k, v]) => (
                <div key={k}>
                  <dt>
                    <kbd>{k}</kbd>
                  </dt>
                  <dd>{v}</dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
        <p className="copy">Gamepads work too: left stick steers, triggers drive, A/B climb and descend.</p>
      </Sheet>
    </>
  );
}
