import { sectionOrder, type SectionId } from '../data/portfolio';

export const SECTION_COUNT = sectionOrder.length;
export const LAST_SECTION = SECTION_COUNT - 1;

/**
 * The journey finishes at 88% of the page: the last stretch is dwell time in
 * the contact room, followed by the fade to darkness. Without it the final
 * island would only ever be framed on the same pixel the fade starts.
 */
export const TRAVEL_END = 0.88;
export const OUTRO_START = 0.915;

/**
 * A tiny mutable store shared between the DOM overlay and the WebGL scene.
 *
 * It is intentionally *not* React state: the values change every frame and
 * pushing them through React would re-render the whole tree 60 times a second.
 * Components that need to react to discrete changes (active section, focused
 * project) subscribe explicitly via `useJourneyIndex` / `useFocus`.
 */
export interface Journey {
  /** Raw scroll position, 0 → 1 across the whole page. */
  scroll: number;
  /** Scroll remapped onto the travelling part of the page, 0 → 1. */
  travel: number;
  /** Plateau-eased position in section space, 0 → LAST_SECTION. */
  flow: number;
  /** Nearest section index. */
  index: number;
  /** 1 when settled on a section, 0 while travelling between two. */
  local: number;
  /** 0 → 1 across the scroll band owned by the current section. */
  band: number;
  /** Smoothed pointer, -1 → 1 on both axes. */
  pointer: { x: number; y: number };
  /** Raw pointer target, lerped towards by `pointer`. */
  pointerTarget: { x: number; y: number };
  /** id of the project the camera is pushed into, or null. */
  focus: string | null;
  /** 0 → 1 blend of the focus camera pose. */
  focusBlend: number;
  /** 0 → 1 fade to darkness at the very end of the journey. */
  outro: number;
  /** Set by the scene once the first frame has rendered. */
  ready: boolean;
}

export const journey: Journey = {
  scroll: 0,
  travel: 0,
  flow: 0,
  index: 0,
  local: 1,
  band: 0.5,
  pointer: { x: 0, y: 0 },
  pointerTarget: { x: 0, y: 0 },
  focus: null,
  focusBlend: 0,
  outro: 0,
  ready: false,
};

/* ------------------------------------------------------------------ */
/* index subscription                                                  */
/* ------------------------------------------------------------------ */

const indexListeners = new Set<() => void>();

export function subscribeIndex(listener: () => void) {
  indexListeners.add(listener);
  return () => indexListeners.delete(listener);
}

export function getIndex() {
  return journey.index;
}

export function publishIndex(next: number) {
  if (next === journey.index) return;
  journey.index = next;
  indexListeners.forEach((l) => l());
}

export function sectionIdAt(index: number): SectionId {
  return sectionOrder[Math.max(0, Math.min(LAST_SECTION, index))];
}

export function scrollTargetFor(index: number) {
  return (index / LAST_SECTION) * TRAVEL_END;
}
