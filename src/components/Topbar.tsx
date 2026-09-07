import { profile } from '../data/portfolio';
import { useJourneyIndex, useScrollToSection } from '../hooks/useJourney';
import { sectionIdAt } from '../state/journey';

export function Topbar() {
  const index = useJourneyIndex();
  const scrollTo = useScrollToSection();

  return (
    <header className="topbar">
      <button type="button" className="brand interactive" onClick={() => scrollTo(0)} aria-label="Back to start">
        <strong>
          KARAN<em>.</em>
        </strong>
        <span className="mono">{sectionIdAt(index).toUpperCase()}</span>
      </button>
      <div className="topbar__right">
        <span className="mono">{profile.location}</span>
        <span className="status-dot" aria-hidden="true" />
      </div>
    </header>
  );
}
