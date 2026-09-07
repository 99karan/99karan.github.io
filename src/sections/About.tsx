import { profile, stats } from '../data/portfolio';

export function About() {
  return (
    <div className="panel__body">
      <p className="eyebrow">
        <i className="rule" aria-hidden="true" />
        01 <b>/ About</b>
      </p>
      <h2 className="title">{profile.about.heading}</h2>
      <p className="lead">{profile.about.body}</p>
      <p className="body">{profile.about.secondary}</p>
      <div className="stats dup">
        {stats.map((stat) => (
          <div className="stat" key={stat.label}>
            <b>{stat.value}</b>
            <span>{stat.label}</span>
            <i>{stat.note}</i>
          </div>
        ))}
      </div>
    </div>
  );
}
