import { skills } from '../data/portfolio';
import { useUI } from '../state/ui';

export function Skills() {
  const { hoveredSkill, setHoveredSkill } = useUI();
  const active = skills.find((skill) => skill.name === hoveredSkill);

  return (
    <div className="panel__body">
      <p className="eyebrow">
        <i className="rule" aria-hidden="true" />
        02 <b>/ Skills</b>
      </p>
      <h2 className="title">
        THE <em>STACK</em>
      </h2>
      <div className="skill-readout" aria-live="polite">
        <b>{active ? active.name : 'Ten orbiting disciplines'}</b>
        <p>
          {active
            ? active.detail
            : 'Hover or tap a node to inspect it — the core slows down while you read.'}
        </p>
      </div>
      <div className="skill-legend">
        {skills.map((skill) => (
          <button
            key={skill.name}
            type="button"
            data-active={hoveredSkill === skill.name}
            onPointerEnter={() => setHoveredSkill(skill.name)}
            onPointerLeave={() => setHoveredSkill(null)}
            onClick={() => setHoveredSkill(hoveredSkill === skill.name ? null : skill.name)}
          >
            {skill.name}
          </button>
        ))}
      </div>
    </div>
  );
}
