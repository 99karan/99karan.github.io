import { useEffect, useRef, useState } from 'react';
import { RepoCity } from './city/RepoCity';
import { chapters, contact, journey, manifesto, principles, site } from './content';
import { Field } from './Field';
import { useTheme } from './hooks';
import { Stage } from './Stage';
import { Xray } from './Xray';
import './site.css';

// Scope the site's base styles before first paint.
document.documentElement.classList.add('site');

function ThemeToggle() {
  const [theme, toggle] = useTheme();
  const label = theme === 'light' ? 'Switch to dark theme' : 'Switch to light theme';
  return (
    <button className="theme-toggle" type="button" onClick={toggle} aria-label={label} title={label}>
      <svg className="theme-toggle__sun" viewBox="0 0 16 16" aria-hidden="true">
        <circle cx="8" cy="8" r="3" fill="none" stroke="currentColor" strokeWidth="1.4" />
        <path
          d="M8 1.2v1.6M8 13.2v1.6M1.2 8h1.6M13.2 8h1.6M3.2 3.2l1.1 1.1M11.7 11.7l1.1 1.1M3.2 12.8l1.1-1.1M11.7 4.3l1.1-1.1"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
        />
      </svg>
      <svg className="theme-toggle__moon" viewBox="0 0 16 16" aria-hidden="true">
        <path d="M13.6 10.1A6 6 0 0 1 5.9 2.4a6 6 0 1 0 7.7 7.7z" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
      </svg>
    </button>
  );
}

function Bar() {
  const [solid, setSolid] = useState(false);
  useEffect(() => {
    const on = () => setSolid(window.scrollY > 40);
    on();
    window.addEventListener('scroll', on, { passive: true });
    return () => window.removeEventListener('scroll', on);
  }, []);
  return (
    <header className={`bar ${solid ? 'is-solid' : ''}`}>
      <div className="wrap bar__in">
        <a className="bar__brand" href="#top">
          {site.name}
        </a>
        <nav className="bar__nav" aria-label="Primary">
          <a className="bar__link bar__link--wide" href="#city">
            City
          </a>
          <a className="bar__link bar__link--wide" href="#work">
            Work
          </a>
          <a className="bar__link bar__link--wide" href="#journey">
            Journey
          </a>
          <a className="bar__link" href="?drive" title="The drivable 3D island version of this portfolio">
            Drive ↗
          </a>
          <a className="bar__link bar__link--cta" href="#contact">
            Contact
          </a>
          <ThemeToggle />
        </nav>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="hero" id="top">
      <div className="wrap hero__in">
        <Xray className="hero__xr" immediate delay={250}>
          <p className="hero__status">
            <span className="pulse" aria-hidden="true" />
            {site.status}
          </p>
          <h1 className="hero__name">
            <span>{site.first}</span> <span>{site.last}</span>
          </h1>
        </Xray>
        <Xray className="hero__lead-xr" bone={site.leadBone} immediate delay={900}>
          <p className="hero__lead">{site.lead}</p>
        </Xray>
        <div className="hero__actions">
          <a className="btn btn--solid" href="#city">
            Walk the repo city
          </a>
          <a className="btn" href="#work">
            See the work
          </a>
          <a className="btn btn--ghost" href={site.resume} download>
            Download résumé
          </a>
        </div>
      </div>
      <p className="hero__hint wrap">{site.hint}</p>
    </section>
  );
}

/** The statement fills in word by word as it crosses the viewport. */
function Manifesto() {
  const ref = useRef<HTMLDivElement>(null);
  const [p, setP] = useState(0);
  useEffect(() => {
    let raf = 0;
    const on = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const el = ref.current;
        if (!el) return;
        const r = el.getBoundingClientRect();
        const vh = window.innerHeight;
        setP(Math.min(1, Math.max(0, (vh * 0.85 - r.top) / (vh * 0.6))));
      });
    };
    on();
    window.addEventListener('scroll', on, { passive: true });
    window.addEventListener('resize', on);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('scroll', on);
      window.removeEventListener('resize', on);
    };
  }, []);
  const words = manifesto.text.split(' ');
  return (
    <section className="manifesto" aria-labelledby="approach-title">
      <div className="wrap" ref={ref}>
        <Xray bone={manifesto.bone} build={false}>
          <h2 className="manifesto__text" id="approach-title" aria-label={manifesto.text}>
            {words.map((w, i) => (
              <span key={i} aria-hidden="true" className={p * words.length > i + 0.3 ? 'is-on' : ''}>
                {w}{' '}
              </span>
            ))}
          </h2>
        </Xray>
      </div>
    </section>
  );
}

function Principles() {
  return (
    <section className="principles" aria-label="How I work">
      <div className="wrap principles__grid">
        {principles.map((pr, i) => (
          <article className="principle" key={pr.title}>
            <span className="principle__index">0{i + 1}</span>
            <Xray as="div" bone={pr.bone} delay={i * 90}>
              <h3 className="principle__title">{pr.title}</h3>
              <p className="principle__text">{pr.text}</p>
            </Xray>
          </article>
        ))}
      </div>
    </section>
  );
}

function Work() {
  return (
    <section className="work" id="work" aria-labelledby="work-title">
      <div className="wrap">
        <Xray className="work-intro">
          <p className="eyebrow">Case studies</p>
          <h2 className="section-title" id="work-title">
            Four builds, end to end.
          </h2>
          <p className="section-lead">What each one does, how it's built, and the decisions that made it work. Each one is a building in the city above.</p>
        </Xray>
      </div>
      {chapters.map((c, i) => (
        <article className={`chapter ${i % 2 ? 'chapter--flip' : ''}`} id={c.id} key={c.id} aria-labelledby={`${c.id}-title`}>
          <div className="wrap chapter__grid">
            <div className="chapter__copy">
              <Xray>
                <p className="chapter__num">
                  0{i + 1} <span>/ 0{chapters.length}</span>
                </p>
                <h3 className="chapter__title" id={`${c.id}-title`}>
                  {c.title}
                </h3>
                <p className="chapter__meta">{c.meta}</p>
              </Xray>
              <Xray bone={c.bone} delay={120}>
                <p className="chapter__lead">{c.lead}</p>
              </Xray>
              <ul className="chapter__wins">
                {c.wins.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
              <p className="chapter__stack">{c.stack}</p>
              <a className="chapter__link" href={`https://github.com/99karan/${c.repo}`} target="_blank" rel="noreferrer">
                github.com/99karan/{c.repo} ↗
              </a>
            </div>
            <Stage chapter={c} />
          </div>
        </article>
      ))}
    </section>
  );
}

function Journey() {
  return (
    <section className="journey" id="journey" aria-labelledby="journey-title">
      <div className="wrap">
        <Xray className="journey__head">
          <p className="eyebrow">Journey</p>
          <h2 className="section-title" id="journey-title">
            How I got here.
          </h2>
        </Xray>
        <ol className="journey__list">
          {journey.map((j, i) => (
            <li className={`step ${i === journey.length - 1 ? 'step--next' : ''}`} key={j.period}>
              <span className="step__n">{String(i + 1).padStart(2, '0')}</span>
              <p className="step__period">{j.period}</p>
              <Xray bone={j.bone} delay={i * 80}>
                <h3 className="step__role">
                  {j.role} <span>· {j.org}</span>
                </h3>
                <p className="step__detail">{j.detail}</p>
              </Xray>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function Contact() {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(site.email);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      window.location.href = `mailto:${site.email}`;
    }
  };
  return (
    <section className="contact" id="contact" aria-labelledby="contact-title">
      <div className="wrap">
        <Xray bone={`status: open to roles
reply: within a day
where: ${site.location.toLowerCase()}`}>
          <h2 className="contact__title" id="contact-title">
            {contact.title}
          </h2>
          <p className="contact__body">{contact.body}</p>
        </Xray>
        <div className="contact__mail">
          <a href={`mailto:${site.email}`} className="contact__email">
            {site.email}
          </a>
          <button type="button" className="btn btn--sm" onClick={copy}>
            {copied ? 'Copied ✓' : 'Copy'}
          </button>
        </div>
        <ul className="contact__links">
          {contact.links.map((l) => (
            <li key={l.id}>
              <a href={l.url} target="_blank" rel="noreferrer">
                <span>{l.label}</span>
                <em>{l.handle}</em>
              </a>
            </li>
          ))}
          <li>
            <a href="./resume.html">
              <span>Résumé</span>
              <em>one page, printable</em>
            </a>
          </li>
          <li>
            <a href="?drive">
              <span>Drive the island</span>
              <em>this portfolio, as a game</em>
            </a>
          </li>
        </ul>
      </div>
    </section>
  );
}

export default function SiteApp() {
  return (
    <>
      <Field />
      <a className="skip" href="#main">
        Skip to content
      </a>
      <Bar />
      <main id="main">
        <Hero />
        <Manifesto />
        <Principles />
        <RepoCity />
        <Work />
        <Journey />
        <Contact />
      </main>
      <footer className="foot">
        <div className="wrap foot__in">
          <span>© {new Date().getFullYear()} {site.name}</span>
          <span className="foot__mono">Built with React, Three.js and a lot of commits.</span>
          <a href="#top">Back to top ↑</a>
        </div>
      </footer>
    </>
  );
}
