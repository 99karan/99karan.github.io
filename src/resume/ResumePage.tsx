import { profile, resume, socials } from '../data/portfolio';

/**
 * One-page A4 resume, generated from src/data/portfolio.ts.
 * The same page is printed to public/resume/karan-prajapat-resume.pdf.
 */
export function ResumePage() {
  const github = socials.find((s) => s.id === 'github');
  const linkedin = socials.find((s) => s.id === 'linkedin');
  const site = resume.website.replace(/^https?:\/\//, '');

  return (
    <>
      <div className="toolbar" role="toolbar" aria-label="Resume actions">
        <a href="./" className="toolbar__link">
          ← Back to the site
        </a>
        <div className="toolbar__actions">
          <button type="button" onClick={() => window.print()}>
            Print
          </button>
          <a className="toolbar__primary" href={profile.resume.file} download>
            Download PDF
          </a>
        </div>
      </div>

      <main className="page">
        <header className="head">
          <div>
            <h1>{profile.name}</h1>
            <p className="headline">{resume.headline}</p>
          </div>
          <ul className="contact">
            <li>
              <a href={`mailto:${profile.email}`}>{profile.email}</a>
            </li>
            <li>
              <a href={resume.website}>{site}</a>
            </li>
            {github && (
              <li>
                <a href={github.url}>github.com/{github.handle.replace('@', '')}</a>
              </li>
            )}
            {linkedin && (
              <li>
                <a href={linkedin.url}>linkedin.com/{linkedin.handle}</a>
              </li>
            )}
            <li>{profile.location}</li>
          </ul>
        </header>

        <p className="summary">{resume.summary}</p>

        <div className="cols">
          <div className="main">
            <section>
              <h2>Experience</h2>
              {resume.experience.map((job) => (
                <article key={job.role + job.period} className="entry">
                  <div className="entry__top">
                    <h3>
                      {job.role} <span className="org">· {job.org}</span>
                    </h3>
                    <span className="period">{job.period}</span>
                  </div>
                  <ul>
                    {job.bullets.map((b) => (
                      <li key={b}>{b}</li>
                    ))}
                  </ul>
                </article>
              ))}
            </section>

            <section>
              <h2>Selected projects</h2>
              {resume.projects.map((p) => (
                <article key={p.name} className="entry">
                  <div className="entry__top">
                    <h3>
                      {p.name} <span className="org">· {p.stack}</span>
                    </h3>
                    {p.link && <span className="period">{p.link}</span>}
                  </div>
                  <ul>
                    {p.bullets.map((b) => (
                      <li key={b}>{b}</li>
                    ))}
                  </ul>
                </article>
              ))}
            </section>
          </div>

          <aside className="side">
            <section>
              <h2>Skills</h2>
              {resume.skills.map((g) => (
                <div key={g.group} className="skill-group">
                  <h4>{g.group}</h4>
                  <p>{g.items.join(' · ')}</p>
                </div>
              ))}
            </section>

            {resume.education.length > 0 && (
              <section>
                <h2>Education</h2>
                {resume.education.map((e) => (
                  <div key={e.degree} className="skill-group">
                    <h4>{e.degree}</h4>
                    <p>
                      {e.school}
                      <br />
                      <span className="period">{e.period}</span>
                    </p>
                    {e.note && <p>{e.note}</p>}
                  </div>
                ))}
              </section>
            )}

            <section>
              <h2>How I work</h2>
              <ul className="plain">
                {resume.strengths.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
            </section>

            <section className="island">
              <h2>See it running</h2>
              <p>
                Drive my portfolio — car, bike, plane, helicopter or boat — at <a href={resume.website}>{site}</a>
              </p>
            </section>
          </aside>
        </div>
      </main>
    </>
  );
}
