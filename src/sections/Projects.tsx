import { projects } from '../data/portfolio';
import { useUI } from '../state/ui';

export function Projects() {
  const { focus, setFocus } = useUI();

  return (
    <div className="panel__body">
      <p className="eyebrow">
        <i className="rule" aria-hidden="true" />
        03 <b>/ Selected work</b>
      </p>
      <h2 className="title">
        BUILT <em>&amp; SHIPPED</em>
      </h2>
      <div className="project-index">
        {projects.map((project) => (
          <button
            key={project.id}
            type="button"
            data-active={focus === project.id}
            onClick={() => setFocus(project.id)}
          >
            <span className="n">{project.index}</span>
            <span className="t">{project.title}</span>
            <span className="go">OPEN →</span>
          </button>
        ))}
      </div>
      <p className="body">Select a screen in the gallery — the camera moves in and the case study opens.</p>
    </div>
  );
}
