import { useEffect, useRef, useState, type ElementType, type ReactNode } from 'react';
import { finePointer, reduceMotion } from './hooks';

type BuildState = 'pending' | 'building' | 'built';

interface XrayProps {
  children: ReactNode;
  /** The spec under the finished thing, as `key: value` lines. Without it the lens shows a wireframe of the text. */
  bone?: string;
  as?: ElementType;
  className?: string;
  /** Scan-build the block the first time it scrolls into view. */
  build?: boolean;
  /** Start the build straight away (the hero), after `delay` ms. */
  immediate?: boolean;
  delay?: number;
  id?: string;
}

function BoneLines({ text }: { text: string }) {
  return (
    <>
      {text.split('\n').map((line, i) => {
        const at = line.indexOf(':');
        return (
          <span className="bone__line" key={i}>
            {at > 0 ? (
              <>
                <span className="bone__key">{line.slice(0, at + 1)}</span>
                {line.slice(at + 1)}
              </>
            ) : (
              line
            )}
          </span>
        );
      })}
    </>
  );
}

/**
 * The x-ray: a finished block of text with its spec underneath.
 * A lens follows the cursor and shows the bone layer through the skin;
 * on first view a scan line builds the skin from the spec down.
 */
export function Xray({ children, bone, as: Tag = 'div', className = '', build = true, immediate, delay = 0, id }: XrayProps) {
  const ref = useRef<HTMLElement>(null);
  const [state, setState] = useState<BuildState>(() => (build && !reduceMotion() ? 'pending' : 'built'));

  // Build once, when it first comes into view.
  useEffect(() => {
    if (state !== 'pending') return;
    const el = ref.current;
    if (!el) return;
    let timer = 0;
    const go = () => {
      timer = window.setTimeout(() => setState('building'), delay);
    };
    if (immediate || !('IntersectionObserver' in window)) {
      go();
      return () => window.clearTimeout(timer);
    }
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          io.disconnect();
          go();
        }
      },
      { rootMargin: '0px 0px -12% 0px' },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      window.clearTimeout(timer);
    };
  }, [state, immediate, delay]);

  // The lens: pointer position as CSS variables, radius eased by CSS.
  useEffect(() => {
    const el = ref.current;
    if (!el || !finePointer()) return;
    const move = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      el.style.setProperty('--mx', `${e.clientX - r.left}px`);
      el.style.setProperty('--my', `${e.clientY - r.top}px`);
    };
    const enter = (e: PointerEvent) => {
      move(e);
      el.classList.add('is-lens');
    };
    const leave = () => el.classList.remove('is-lens');
    el.addEventListener('pointermove', move, { passive: true });
    el.addEventListener('pointerenter', enter);
    el.addEventListener('pointerleave', leave);
    return () => {
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerenter', enter);
      el.removeEventListener('pointerleave', leave);
    };
  }, []);

  return (
    <Tag
      ref={ref}
      id={id}
      className={`xr ${bone ? 'xr--bone' : 'xr--ghost'} ${className}`}
      data-state={state}
      onAnimationEnd={(e: React.AnimationEvent) => {
        if (e.animationName === 'xr-scan' && e.target === e.currentTarget) setState('built');
      }}
    >
      <div className="xr__skin">{children}</div>
      <div className="xr__bone" aria-hidden="true">
        {bone ? <BoneLines text={bone} /> : <div className="xr__wire">{children}</div>}
      </div>
      <span className="xr__beam" aria-hidden="true" />
    </Tag>
  );
}
