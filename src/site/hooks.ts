import { useCallback, useEffect, useState, type RefObject } from 'react';

export const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
export const finePointer = () => window.matchMedia('(hover: hover) and (pointer: fine)').matches;

/** True while the element is within `margin` of the viewport. */
export function useInView(ref: RefObject<Element>, margin = '0px', once = false): boolean {
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!('IntersectionObserver' in window)) {
      setInView(true);
      return;
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        setInView(entry.isIntersecting);
        if (entry.isIntersecting && once) io.disconnect();
      },
      { rootMargin: margin },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [ref, margin, once]);
  return inView;
}

export type Theme = 'dark' | 'light';

const THEME_KEY = 'kp-theme';
const listeners = new Set<(t: Theme) => void>();

export function currentTheme(): Theme {
  return document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';
}

/** The theme lives on <html data-theme>; canvases subscribe here to repaint. */
export function useTheme(): [Theme, () => void] {
  const [theme, setTheme] = useState<Theme>(currentTheme);
  useEffect(() => {
    listeners.add(setTheme);
    return () => void listeners.delete(setTheme);
  }, []);
  const toggle = useCallback(() => {
    const next: Theme = currentTheme() === 'light' ? 'dark' : 'light';
    const root = document.documentElement;
    if (next === 'light') root.dataset.theme = 'light';
    else delete root.dataset.theme;
    const meta = (n: string) => document.querySelector<HTMLMetaElement>(`meta[name="${n}"]`);
    meta('theme-color')?.setAttribute('content', next === 'light' ? '#f2eee6' : '#06090b');
    meta('color-scheme')?.setAttribute('content', next);
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {
      /* private mode */
    }
    listeners.forEach((l) => l(next));
  }, []);
  return [theme, toggle];
}

/** Resolved colours from the CSS tokens, for canvas drawing. */
export interface Ink {
  ground: string;
  bone: string;
  ash: string;
  dim: string;
  signal: string;
  boneRgb: string;
  signalRgb: string;
}

export function readInk(): Ink {
  const s = getComputedStyle(document.documentElement);
  const v = (n: string) => s.getPropertyValue(n).trim();
  return {
    ground: v('--ground'),
    bone: v('--bone'),
    ash: v('--ash'),
    dim: v('--dim'),
    signal: v('--signal'),
    boneRgb: v('--bone-rgb'),
    signalRgb: v('--signal-rgb'),
  };
}
