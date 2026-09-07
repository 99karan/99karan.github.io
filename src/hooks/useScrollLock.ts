import { useEffect } from 'react';

/**
 * Freezes the journey while an overlay is open without touching `overflow`,
 * which would reset scrollY and snap the camera back to the hero.
 */
export function useScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) return;

    const allow = (target: EventTarget | null) =>
      target instanceof Element && target.closest('[data-scrollable]') !== null;

    const block = (event: Event) => {
      if (!allow(event.target)) event.preventDefault();
    };
    const onKey = (event: KeyboardEvent) => {
      const keys = ['PageDown', 'PageUp', 'End', 'Home', 'ArrowDown', 'ArrowUp', ' '];
      if (keys.includes(event.key) && !allow(event.target)) event.preventDefault();
    };

    window.addEventListener('wheel', block, { passive: false });
    window.addEventListener('touchmove', block, { passive: false });
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('wheel', block);
      window.removeEventListener('touchmove', block);
      window.removeEventListener('keydown', onKey);
    };
  }, [active]);
}
