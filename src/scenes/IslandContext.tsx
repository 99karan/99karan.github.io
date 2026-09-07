import { createContext, useContext } from 'react';
import { presenceAt } from '../hooks/usePresence';
import { smoothstep } from '../animations/easing';

interface IslandInfo {
  index: number;
  span: number;
}

const IslandContext = createContext<IslandInfo>({ index: 0, span: 1.4 });

export const IslandProvider = IslandContext.Provider;

/**
 * Raw presence → visible weight. The dead zone below 0.22 matters: without it
 * a neighbouring island still hangs in frame at ~10% opacity, which reads as a
 * rendering bug rather than depth.
 */
export const islandFade = (presence: number) => smoothstep((presence - 0.22) / 0.78);

/**
 * How present the surrounding island is, 0 → 1. Emissive surfaces read it every
 * frame and fade themselves out: additive holograms are visible from two
 * islands away otherwise, and would hang in the hero frame like ghosts.
 */
export function useIslandPresence() {
  const { index, span } = useContext(IslandContext);
  return () => islandFade(presenceAt(index, span));
}
