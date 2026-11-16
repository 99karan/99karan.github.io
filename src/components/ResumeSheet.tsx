import { profile, resume } from '../data/portfolio';
import { useUI } from '../state/ui';
import { Sheet } from './Sheet';

/**
 * In-page preview built from the same `resume` data as /resume.html and the
 * PDF, so the three can never drift apart.
 */
export function ResumeSheet() {
  const { resumeOpen, setResumeOpen } = useUI();

  return (
    <Sheet
      open={resumeOpen}
      onClose={() => setResumeOpen(false)}
      label="Resume preview"
      eyebrow={`RESUME · ${profile.resume.updated.toUpperCase()}`}
    >
      <div className="resume">
        <h3>{profile.name}</h3>
        <div className="role">{resume.headline}</div>
        <p className="tagline">{resume.summary}</p>
        <hr />
        <h4>Experience</h4>
        {resume.experience.map((job) => (
          <div key={job.role + job.period} style={{ marginBottom: '0.7rem' }}>
            <div className="row">
              <b>
                {job.role} · {job.org}
              </b>
              <span>{job.period}</span>
            </div>
            <ul>
              {job.bullets.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
          </div>
        ))}
        <hr />
        <h4>Selected projects</h4>
        {resume.projects.map((p) => (
          <div key={p.name} style={{ marginBottom: '0.6rem' }}>
            <div className="row">
              <b>{p.name}</b>
              <span>{p.stack}</span>
            </div>
            <p>{p.bullets.join(' ')}</p>
          </div>
        ))}
        <hr />
        <h4>Skills</h4>
        <div className="grid2">
          {resume.skills.map((g) => (
            <p key={g.group}>
              <b>{g.group}</b> — {g.items.join(', ')}
            </p>
          ))}
        </div>
        <hr />
        <h4>Contact</h4>
        <p>
          {profile.email} · {profile.location}
        </p>
      </div>

      <div className="sheet__actions">
        <a className="btn btn--primary" href={profile.resume.file} download target="_blank" rel="noopener noreferrer">
          <span className="btn__dot" aria-hidden="true" />
          Download PDF
        </a>
        <a className="btn" href="./resume.html" target="_blank" rel="noopener noreferrer">
          Full page
        </a>
        <button type="button" className="btn btn--ghost" onClick={() => setResumeOpen(false)}>
          ← Back
        </button>
      </div>
    </Sheet>
  );
}
