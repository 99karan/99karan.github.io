import { profile } from '../data/portfolio';
import { useScrollToSection } from '../hooks/useJourney';
import { useUI } from '../state/ui';

export function Hero() {
  const scrollTo = useScrollToSection();
  const { setResumeOpen } = useUI();

  return (
    <div className="panel__body">
      <p className="eyebrow">
        <i className="rule" aria-hidden="true" />
        Portfolio <b>/ 2026</b>
      </p>
      <h1 className="title title--hero dup">
        KARAN
        <br />
        PRAJAPAT
      </h1>
      <p className="lead">Flutter Developer · Software Engineer</p>
      <p className="body sr-only">{profile.tagline}</p>
      <div className="actions">
        <button type="button" className="btn btn--primary" onClick={() => scrollTo(3)}>
          <span className="btn__dot" aria-hidden="true" />
          Explore my work
        </button>
        <button type="button" className="btn" onClick={() => setResumeOpen(true)}>
          Download resume
        </button>
      </div>
    </div>
  );
}
