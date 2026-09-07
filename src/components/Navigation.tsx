import { navigation } from '../data/portfolio';
import { useJourneyIndex, useScrollToSection } from '../hooks/useJourney';
import { sectionOrder } from '../data/portfolio';

/**
 * The scene is the navigation; this rail is the index to it. On phones it
 * collapses to a conventional pill bar so nobody has to discover the gesture.
 */
export function Navigation() {
  const index = useJourneyIndex();
  const scrollTo = useScrollToSection();

  return (
    <>
      <nav className="nav" aria-label="Sections">
        {navigation.map((item) => {
          const target = sectionOrder.indexOf(item.id);
          return (
            <button
              key={item.id}
              type="button"
              className="nav__item interactive"
              data-active={index === target}
              onClick={() => scrollTo(target)}
              aria-current={index === target ? 'true' : undefined}
            >
              <span className="idx">{item.index}</span>
              <span className="label">{item.label}</span>
              <i />
            </button>
          );
        })}
      </nav>

      <nav className="mobilenav" aria-label="Sections">
        <button type="button" data-active={index === 0} onClick={() => scrollTo(0)}>
          HOME
        </button>
        {navigation.map((item) => {
          const target = sectionOrder.indexOf(item.id);
          return (
            <button
              key={item.id}
              type="button"
              data-active={index === target}
              onClick={() => scrollTo(target)}
            >
              {item.label}
            </button>
          );
        })}
      </nav>
    </>
  );
}
