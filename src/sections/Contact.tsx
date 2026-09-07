import { profile, socials } from '../data/portfolio';
import { useUI } from '../state/ui';

export function Contact() {
  const { setResumeOpen } = useUI();

  return (
    <div className="panel__body">
      <p className="eyebrow">
        <i className="rule" aria-hidden="true" />
        05 <b>/ Contact</b>
      </p>
      <h2 className="title">{profile.contact.heading}</h2>
      <p className="lead">{profile.contact.body}</p>
      <a className="contact-mail" href={`mailto:${profile.email}`}>
        {profile.email}
      </a>
      <div className="contact-links">
        <span className="dup contact-dup">
        {socials.map((social) => (
          <a
            key={social.id}
            className="btn"
            href={social.url}
            target={social.id === 'email' ? undefined : '_blank'}
            rel="noopener noreferrer"
          >
            {social.label}
          </a>
        ))}
        </span>
        <button type="button" className="btn btn--primary" onClick={() => setResumeOpen(true)}>
          Resume
        </button>
      </div>
    </div>
  );
}
