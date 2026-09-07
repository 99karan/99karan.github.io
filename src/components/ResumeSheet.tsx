import { milestones, profile, skills } from '../data/portfolio';
import { useUI } from '../state/ui';
import { Sheet } from './Sheet';

/**
 * A readable preview built from the same data file as the rest of the site, so
 * it can never drift from the PDF's story. The button downloads the real file.
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
        <div className="role">Flutter Developer · Software Engineer</div>
        <p className="tagline">{profile.tagline}</p>
        <hr />
        <h4>Profile</h4>
        <p>{profile.about.body}</p>
        <hr />
        <h4>Experience</h4>
        {milestones.slice(0, 3).map((milestone) => (
          <div key={milestone.id} style={{ marginBottom: '0.7rem' }}>
            <div className="row">
              <b>{milestone.role}</b>
              <span>{milestone.period}</span>
            </div>
            <p>{milestone.detail}</p>
          </div>
        ))}
        <hr />
        <h4>Skills</h4>
        <div className="grid2">
          {skills.map((skill) => (
            <p key={skill.name}>
              <b>{skill.name}</b> — {skill.detail}
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
          Download resume
        </a>
        <button type="button" className="btn btn--ghost" onClick={() => setResumeOpen(false)}>
          ← Back to the space
        </button>
      </div>
    </Sheet>
  );
}
