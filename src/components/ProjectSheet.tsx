import { projects } from '../data/portfolio';
import { useUI } from '../state/ui';
import { Sheet } from './Sheet';

export function ProjectSheet() {
  const { focus, setFocus } = useUI();
  const project = projects.find((item) => item.id === focus) ?? null;

  return (
    <Sheet
      open={project !== null}
      onClose={() => setFocus(null)}
      label={project ? `${project.title} case study` : 'Project'}
      eyebrow={project ? `PROJECT ${project.index}` : 'PROJECT'}
    >
      {project && (
        <>
          <h2>{project.title}</h2>
          <p className="sheet__tagline">{project.tagline}</p>
          <p className="copy">{project.description}</p>
          <p className="copy">{project.detail}</p>
          <ul>
            {project.highlights.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          <div className="chips">
            {project.tech.map((tech) => (
              <span key={tech}>{tech}</span>
            ))}
          </div>
          <div className="sheet__actions">
            {project.github && (
              <a className="btn btn--primary" href={project.github} target="_blank" rel="noopener noreferrer">
                <span className="btn__dot" aria-hidden="true" />
                GitHub
              </a>
            )}
            {project.demo && (
              <a className="btn" href={project.demo} target="_blank" rel="noopener noreferrer">
                Live demo
              </a>
            )}
            <button type="button" className="btn btn--ghost" onClick={() => setFocus(null)}>
              ← Back to the gallery
            </button>
          </div>
        </>
      )}
    </Sheet>
  );
}
