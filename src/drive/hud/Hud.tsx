import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { milestones, profile } from '../../data/portfolio';
import { useUI } from '../../state/ui';
import { sound } from '../audio';
import { fireAction, touch } from '../input';
import { runtime, store, useStore, VEHICLES, type VehicleKind } from '../state';
import { tokens, zones } from '../world/placements';
import { VehicleIcon } from './Icons';
import { Minimap } from './Minimap';

/* ------------------------------------------------------------------ gauge */

/** Instrument cluster. Reads the runtime directly — no React re-renders. */
function Gauge() {
  const vehicle = useStore((s) => s.vehicle);
  const big = useRef<HTMLSpanElement>(null);
  const unit = useRef<HTMLSpanElement>(null);
  const a = useRef<HTMLSpanElement>(null);
  const b = useRef<HTMLSpanElement>(null);
  const bar = useRef<HTMLElement>(null);
  const warn = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const kmh = Math.abs(runtime.speed) * 3.6;
      const set = (el: HTMLElement | null, v: string) => {
        if (el && el.textContent !== v) el.textContent = v;
      };
      if (vehicle === 'plane') {
        set(big.current, String(Math.round(kmh)));
        set(unit.current, 'KM/H AIRSPEED');
        set(a.current, `ALT ${Math.round(runtime.altitude)} m`);
        set(b.current, `THR ${Math.round(runtime.throttle * 100)}%`);
        if (warn.current) warn.current.hidden = !(runtime.grounded === false && runtime.speed < 24);
      } else if (vehicle === 'heli') {
        set(big.current, String(Math.round(runtime.altitude)));
        set(unit.current, 'M ALTITUDE');
        set(a.current, `SPD ${Math.round(kmh)} km/h`);
        set(b.current, `V/S ${runtime.velocity.y >= 0 ? '+' : ''}${runtime.velocity.y.toFixed(1)}`);
        if (warn.current) warn.current.hidden = true;
      } else if (vehicle === 'boat') {
        set(big.current, String(Math.round(kmh / 1.852)));
        set(unit.current, 'KNOTS');
        set(a.current, `${Math.round(kmh)} km/h`);
        set(b.current, runtime.speed < -0.5 ? 'REVERSE' : 'AHEAD');
        if (warn.current) warn.current.hidden = true;
      } else {
        set(big.current, String(Math.round(kmh)));
        set(unit.current, 'KM/H');
        const top = vehicle === 'car' ? 54 : 60;
        const gear = runtime.speed < -0.5 ? 'R' : kmh < 2 ? 'N' : String(Math.min(6, 1 + Math.floor(Math.abs(runtime.speed) / (top / 6))));
        set(a.current, `GEAR ${gear}`);
        set(b.current, runtime.airTime > 0.2 ? `AIR ${runtime.airTime.toFixed(1)}s` : `${Math.round(runtime.rpm * 8000)} rpm`);
        if (warn.current) warn.current.hidden = true;
      }
      if (bar.current) bar.current.style.transform = `scaleX(${Math.min(1, runtime.rpm).toFixed(3)})`;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [vehicle]);

  return (
    <div className="gauge" aria-hidden="true">
      <div className="gauge__big">
        <span ref={big}>0</span>
        <span ref={unit} className="gauge__unit">KM/H</span>
      </div>
      <div className="gauge__bar">
        <i ref={bar} />
      </div>
      <div className="gauge__row">
        <span ref={a} />
        <span ref={b} />
      </div>
      <div ref={warn} className="gauge__warn" hidden>
        STALL
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- switcher */

function Switcher() {
  const vehicle = useStore((s) => s.vehicle);
  return (
    <nav className="switcher" aria-label="Choose a vehicle">
      {VEHICLES.map((v) => (
        <button
          key={v.id}
          type="button"
          className="switcher__btn"
          data-active={v.id === vehicle}
          aria-pressed={v.id === vehicle}
          title={`${v.label} — ${v.blurb}`}
          onClick={() => store.setVehicle(v.id)}
        >
          <VehicleIcon kind={v.id} />
          <span className="switcher__label">{v.label}</span>
          <kbd>{v.key}</kbd>
        </button>
      ))}
    </nav>
  );
}

/* ------------------------------------------------------------------ top */

function TopBar() {
  const { setResumeOpen } = useUI();
  const night = useStore((s) => s.night);
  const muted = useStore((s) => s.muted);
  const collected = useStore((s) => s.collected.length);
  return (
    <header className="hud-top">
      <div className="hud-brand">
        <strong>{profile.name}</strong>
        <span className="mono">{profile.role}</span>
      </div>
      <div className="hud-actions">
        <button type="button" className="chip chip--accent" onClick={() => store.set({ panel: 'places' })}>
          Places
        </button>
        <button type="button" className="chip" onClick={() => setResumeOpen(true)}>
          Resume
        </button>
        <button type="button" className="chip" onClick={() => store.set({ panel: 'contact' })}>
          Contact
        </button>
        <a className="chip chip--ghost" href="?classic">
          Classic site
        </a>
        <button type="button" className="chip chip--icon" aria-label={night ? 'Switch to day' : 'Switch to night'} title="Day / night (N)" onClick={() => store.set({ night: !night })}>
          {night ? '☀' : '☾'}
        </button>
        <button
          type="button"
          className="chip chip--icon"
          aria-label={muted ? 'Unmute' : 'Mute'}
          title="Sound (M)"
          onClick={() => {
            sound.start();
            store.set({ muted: !muted });
          }}
        >
          {muted ? '🔇' : '🔊'}
        </button>
        <button type="button" className="chip chip--icon" aria-label="Controls" title="Controls (?)" onClick={() => store.set({ panel: 'help' })}>
          ?
        </button>
      </div>
      <div className="hud-map">
        <Minimap />
        <button type="button" className="hud-skills" onClick={() => store.set({ panel: 'skills' })}>
          <b>{collected}</b>/{tokens.length} skills found
        </button>
      </div>
    </header>
  );
}

/* --------------------------------------------------------------- zone card */

function ZoneCard() {
  const zoneId = useStore((s) => s.zone);
  const zone = zones.find((z) => z.id === zoneId);
  if (!zone) return null;

  if (zone.kind === 'milestone') {
    const m = milestones.find((x) => x.id === zone.ref)!;
    return (
      <aside className="zone-card zone-card--milestone" aria-live="polite">
        <span className="mono zone-card__eyebrow">EXPERIENCE · {m.period}</span>
        <h3>{m.role}</h3>
        <p className="zone-card__org">{m.org}</p>
        <p>{m.detail}</p>
        <div className="chips">
          {m.tags.map((t) => (
            <span key={t}>{t}</span>
          ))}
        </div>
      </aside>
    );
  }

  return (
    <aside className="zone-card" aria-live="polite">
      <span className="mono zone-card__eyebrow">{zone.kind === 'project' ? 'PROJECT' : zone.kind.toUpperCase()}</span>
      <h3>{zone.title}</h3>
      <p>{zone.subtitle}</p>
      <button type="button" className="btn btn--primary zone-card__go" onClick={() => fireAction('interact')}>
        <span className="btn__dot" aria-hidden="true" />
        Open <kbd>E</kbd>
      </button>
    </aside>
  );
}

/* ----------------------------------------------------------------- toasts */

function Toasts() {
  const toasts = useStore((s) => s.toasts);
  return (
    <div className="toasts" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className="toast" data-tone={t.tone ?? 'info'}>
          <b>{t.title}</b>
          {t.body && <span>{t.body}</span>}
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ intro */

function Intro({ touchUI }: { touchUI: boolean }) {
  const started = useStore((s) => s.started);
  if (started) return null;
  const begin = () => {
    sound.start();
    store.set({ started: true, muted: false });
    sound.setMuted(false);
  };
  return (
    <div className="intro" role="dialog" aria-label="Welcome">
      <div className="intro__card">
        <span className="mono intro__eyebrow">AN ISLAND, NOT A WEBSITE</span>
        <h1>{profile.name}</h1>
        <p className="intro__role">{profile.role}</p>
        <p>
          Drive, ride, fly and sail around my island. Every landmark is part of my portfolio — projects on the billboards,
          experience on the career road, contact at the lighthouse. Ten skills are hidden around the map; some need a plane to reach.
        </p>
        <div className="intro__vehicles">
          {VEHICLES.map((v) => (
            <span key={v.id}>
              <VehicleIcon kind={v.id} size={20} /> {v.label}
            </span>
          ))}
        </div>
        <ul className="intro__keys mono">
          {touchUI ? (
            <>
              <li>Left thumb — steer &amp; throttle</li>
              <li>Right buttons — boost, brake, climb</li>
            </>
          ) : (
            <>
              <li><kbd>W A S D</kbd> / arrows — drive</li>
              <li><kbd>1</kbd>–<kbd>5</kbd> — switch vehicle</li>
              <li><kbd>Shift</kbd> boost · <kbd>Space</kbd> brake / climb</li>
              <li><kbd>E</kbd> open · <kbd>R</kbd> reset · <kbd>?</kbd> all controls</li>
            </>
          )}
        </ul>
        <div className="intro__actions">
          <button type="button" className="btn btn--primary" onClick={begin} autoFocus>
            <span className="btn__dot" aria-hidden="true" />
            Start exploring
          </button>
          <a className="btn btn--ghost" href="./resume.html">
            Just the resume
          </a>
          <a className="btn btn--ghost" href="?classic">
            Classic site
          </a>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ touch */

function TouchControls() {
  const vehicle = useStore((s) => s.vehicle);
  const pad = useRef<HTMLDivElement>(null);
  const knob = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(false);
  const origin = useRef({ x: 0, y: 0, id: -1 });

  const R = 56;
  const onDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    origin.current = { x: e.clientX, y: e.clientY, id: e.pointerId };
    pad.current?.setPointerCapture(e.pointerId);
    touch.active = true;
    setActive(true);
  };
  const onMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.pointerId !== origin.current.id) return;
    let dx = e.clientX - origin.current.x;
    let dy = e.clientY - origin.current.y;
    const d = Math.hypot(dx, dy);
    if (d > R) {
      dx = (dx / d) * R;
      dy = (dy / d) * R;
    }
    touch.x = dx / R;
    touch.y = -dy / R;
    if (knob.current) knob.current.style.transform = `translate(${dx}px, ${dy}px)`;
  };
  const onUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.pointerId !== origin.current.id) return;
    origin.current.id = -1;
    touch.x = touch.y = 0;
    if (knob.current) knob.current.style.transform = '';
    setActive(false);
  };

  const hold = (key: 'boost' | 'brake' | 'up' | 'down') => ({
    onPointerDown: (e: ReactPointerEvent<HTMLButtonElement>) => {
      e.currentTarget.setPointerCapture(e.pointerId);
      touch.active = true;
      if (key === 'boost') touch.boost = true;
      if (key === 'brake') touch.brake = true;
      if (key === 'up') touch.lift = 1;
      if (key === 'down') touch.lift = -1;
    },
    onPointerUp: () => {
      if (key === 'boost') touch.boost = false;
      if (key === 'brake') touch.brake = false;
      if (key === 'up' || key === 'down') touch.lift = 0;
    },
    onPointerCancel: () => {
      touch.boost = touch.brake = false;
      touch.lift = 0;
    },
  });

  return (
    <div className="touch" aria-hidden="true">
      <div ref={pad} className="touch__pad" data-active={active} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
        <div ref={knob} className="touch__knob" />
      </div>
      <div className="touch__buttons">
        {vehicle === 'heli' ? (
          <>
            <button type="button" className="touch__btn" {...hold('up')}>▲</button>
            <button type="button" className="touch__btn" {...hold('down')}>▼</button>
          </>
        ) : (
          <button type="button" className="touch__btn" {...hold('brake')}>{vehicle === 'plane' ? 'SLOW' : 'BRAKE'}</button>
        )}
        <button type="button" className="touch__btn touch__btn--accent" {...hold('boost')}>BOOST</button>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------- hud */

export function Hud({ touchUI }: { touchUI: boolean }) {
  const started = useStore((s) => s.started);
  const vehicle: VehicleKind = useStore((s) => s.vehicle);
  return (
    <div className="hud" data-started={started} data-vehicle={vehicle}>
      <TopBar />
      <Toasts />
      <ZoneCard />
      <div className="hud-bottom">
        <Gauge />
        <Switcher />
      </div>
      {touchUI && started && <TouchControls />}
      <Intro touchUI={touchUI} />
    </div>
  );
}
