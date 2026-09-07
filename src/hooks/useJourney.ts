import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react';
import { gsap } from 'gsap';
import { ScrollToPlugin } from 'gsap/ScrollToPlugin';
import {
  LAST_SECTION,
  getIndex,
  journey,
  publishIndex,
  scrollTargetFor,
  subscribeIndex,
} from '../state/journey';
import { clamp, damp, plateau } from '../animations/easing';

gsap.registerPlugin(ScrollToPlugin);

type FrameCallback = (dt: number) => void;

const frameListeners = new Set<FrameCallback>();

/** Subscribe to the shared animation frame used to write overlay styles. */
export function useJourneyFrame(callback: FrameCallback) {
  const ref = useRef(callback);
  ref.current = callback;
  useEffect(() => {
    const fn: FrameCallback = (dt) => ref.current(dt);
    frameListeners.add(fn);
    return () => {
      frameListeners.delete(fn);
    };
  }, []);
}

/** Re-renders only when the active section changes. */
export function useJourneyIndex() {
  return useSyncExternalStore(subscribeIndex, getIndex, getIndex);
}

/** Total scrollable height, in px, for the whole journey. */
export function journeyHeight() {
  return Math.round(window.innerHeight * (LAST_SECTION * 1.15 + 1.35));
}

/**
 * Owns the single requestAnimationFrame loop that turns raw scroll + pointer
 * input into the shared `journey` state, then lets overlay subscribers write
 * their DOM styles in the same frame.
 */
export function useJourneyDriver(active: boolean) {
  useEffect(() => {
    if (!active) return;

    let raf = 0;
    let last = performance.now();
    let maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);

    const measure = () => {
      maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    };

    const onPointer = (event: PointerEvent) => {
      journey.pointerTarget.x = (event.clientX / window.innerWidth) * 2 - 1;
      journey.pointerTarget.y = (event.clientY / window.innerHeight) * 2 - 1;
    };

    const onLeave = () => {
      journey.pointerTarget.x = 0;
      journey.pointerTarget.y = 0;
    };

    const tick = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.1);
      last = now;

      journey.scroll = clamp(window.scrollY / maxScroll);
      journey.flow = damp(journey.flow, plateau(journey.scroll, LAST_SECTION), 7, dt);

      const nearest = Math.round(journey.flow);
      journey.local = clamp(1 - Math.abs(journey.flow - nearest) * 2.6);
      // 0 → 1 across the raw scroll band that belongs to the current section,
      // used for travel *within* a section (the timeline walk).
      journey.band = clamp(journey.scroll * LAST_SECTION - (nearest - 0.5));
      publishIndex(nearest);

      journey.pointer.x = damp(journey.pointer.x, journey.pointerTarget.x, 3.4, dt);
      journey.pointer.y = damp(journey.pointer.y, journey.pointerTarget.y, 3.4, dt);

      journey.focusBlend = damp(journey.focusBlend, journey.focus ? 1 : 0, 3.6, dt);
      journey.outro = clamp((journey.scroll - 0.965) / 0.035);

      frameListeners.forEach((fn) => fn(dt));
      raf = requestAnimationFrame(tick);
    };

    measure();
    raf = requestAnimationFrame(tick);
    window.addEventListener('resize', measure);
    window.addEventListener('orientationchange', measure);
    window.addEventListener('pointermove', onPointer, { passive: true });
    window.addEventListener('pointerleave', onLeave);
    const remeasure = window.setInterval(measure, 1000);

    return () => {
      cancelAnimationFrame(raf);
      window.clearInterval(remeasure);
      window.removeEventListener('resize', measure);
      window.removeEventListener('orientationchange', measure);
      window.removeEventListener('pointermove', onPointer);
      window.removeEventListener('pointerleave', onLeave);
    };
  }, [active]);
}

export function useScrollToSection() {
  return useCallback((index: number, duration?: number) => {
    const maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    const target = scrollTargetFor(index) * maxScroll;
    const distance = Math.abs(target - window.scrollY) / Math.max(maxScroll, 1);
    gsap.to(window, {
      scrollTo: { y: target, autoKill: false },
      duration: duration ?? 1.1 + distance * 1.6,
      ease: 'power3.inOut',
      overwrite: true,
    });
  }, []);
}
