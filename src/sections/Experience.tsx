import { useRef } from 'react';
import { milestones } from '../data/portfolio';
import { useJourneyFrame } from '../hooks/useJourney';
import { journey, LAST_SECTION } from '../state/journey';
import { clamp } from '../animations/easing';

const SECTION_INDEX = 4;

export function Experience() {
  const rows = useRef<(HTMLDivElement | null)[]>([]);

  // The active milestone follows the same band progress the camera uses, so the
  // list and the 3D timeline are never out of step.
  useJourneyFrame(() => {
    const band = clamp(journey.scroll * LAST_SECTION - (SECTION_INDEX - 0.5));
    const count = milestones.length;
    rows.current.forEach((row, i) => {
      if (!row) return;
      const threshold = count <= 1 ? 0.5 : i / (count - 1);
      const isActive = Math.abs(band - threshold) < 0.22;
      const next = isActive ? 'true' : 'false';
      if (row.dataset.active !== next) row.dataset.active = next;
    });
  });

  return (
    <div className="panel__body">
      <p className="eyebrow">
        <i className="rule" aria-hidden="true" />
        04 <b>/ Experience</b>
      </p>
      <h2 className="title">
        THE <em>TIMELINE</em>
      </h2>
      <div className="timeline-list dup">
        {milestones.map((milestone, i) => (
          <div
            className="timeline-row"
            key={milestone.id}
            data-active="false"
            ref={(el) => {
              rows.current[i] = el;
            }}
          >
            <span className="p">{milestone.period}</span>
            <div>
              <div className="r">{milestone.role}</div>
              <div className="o">{milestone.org}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
