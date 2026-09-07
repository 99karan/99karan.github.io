import { useMemo } from 'react';

export type Tier = 'low' | 'mid' | 'high';

export interface Quality {
  tier: Tier;
  isMobile: boolean;
  isTouch: boolean;
  reducedMotion: boolean;
  /** [min, max] device pixel ratio handed to the renderer. */
  dpr: [number, number];
  shadows: boolean;
  shadowSize: number;
  bloom: boolean;
  bloomIntensity: number;
  dof: boolean;
  ao: boolean;
  grain: boolean;
  /** Background particle count. */
  particles: number;
  /** Extra detail meshes (keycaps, desk props, floating shards). */
  props: boolean;
  keycaps: boolean;
  grid: boolean;
  /** Texture resolution multiplier for canvas-generated screens. */
  textureScale: number;
  segments: number;
}

function detectTier(): { tier: Tier; isMobile: boolean; isTouch: boolean } {
  if (typeof window === 'undefined') return { tier: 'high', isMobile: false, isTouch: false };

  const ua = navigator.userAgent;
  const isTouchEarly = window.matchMedia('(hover: none) and (pointer: coarse)').matches;

  // `?quality=low|mid|high` — an escape hatch for testing and for visitors on
  // hardware the heuristic reads wrong.
  const override = new URLSearchParams(window.location.search).get('quality');
  if (override === 'low' || override === 'mid' || override === 'high') {
    return {
      tier: override,
      isMobile: /Android|iPhone|iPad|iPod|Mobile|Silk/i.test(ua),
      isTouch: isTouchEarly,
    };
  }

  const isTouch = window.matchMedia('(hover: none) and (pointer: coarse)').matches;
  const isMobile = /Android|iPhone|iPad|iPod|Mobile|Silk/i.test(ua) || (isTouch && window.innerWidth < 900);

  const cores = navigator.hardwareConcurrency ?? 4;
  const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 4;
  const pixels = window.innerWidth * window.innerHeight * Math.min(window.devicePixelRatio, 2);

  let score = 0;
  score += cores >= 8 ? 2 : cores >= 6 ? 1 : cores <= 3 ? -2 : 0;
  score += memory >= 8 ? 2 : memory >= 4 ? 1 : -2;
  score += isMobile ? -2 : 1;
  score += pixels > 4_500_000 ? -1 : 0;

  const tier: Tier = score >= 3 ? 'high' : score >= 0 ? 'mid' : 'low';
  return { tier, isMobile, isTouch };
}

const PRESETS: Record<Tier, Omit<Quality, 'tier' | 'isMobile' | 'isTouch' | 'reducedMotion'>> = {
  high: {
    dpr: [1.5, 2],
    shadows: true,
    shadowSize: 1024,
    bloom: true,
    bloomIntensity: 0.7,
    dof: true,
    ao: false,
    grain: true,
    particles: 1400,
    props: true,
    keycaps: true,
    grid: true,
    textureScale: 1,
    segments: 12,
  },
  mid: {
    dpr: [1.25, 2],
    shadows: true,
    shadowSize: 512,
    bloom: true,
    bloomIntensity: 0.6,
    dof: false,
    ao: false,
    grain: true,
    particles: 750,
    props: true,
    keycaps: true,
    grid: true,
    textureScale: 0.75,
    segments: 8,
  },
  low: {
    dpr: [1, 1.75],
    shadows: false,
    shadowSize: 512,
    bloom: true,
    bloomIntensity: 0.5,
    dof: false,
    ao: false,
    grain: false,
    particles: 320,
    props: false,
    keycaps: false,
    grid: true,
    textureScale: 0.6,
    segments: 6,
  },
};

/**
 * Decided once, at mount: renderer flags such as `shadows` cannot be toggled
 * cheaply afterwards. Runtime dips are handled by <PerformanceMonitor/>, which
 * lowers the pixel ratio instead of rebuilding the scene.
 */
export function useQuality(): Quality {
  return useMemo(() => {
    const { tier, isMobile, isTouch } = detectTier();
    const reducedMotion =
      typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    return { tier, isMobile, isTouch, reducedMotion, ...PRESETS[tier] };
  }, []);
}
