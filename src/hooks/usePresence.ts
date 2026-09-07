import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { journey } from '../state/journey';
import { clamp } from '../animations/easing';

/**
 * How "present" an island is: 1 when the camera rests on it, 0 once it is more
 * than `span` sections away. Animation work is skipped below `epsilon`, which
 * keeps the frame budget on whatever the visitor is actually looking at.
 */
export function usePresence(index: number, span = 1) {
  const ref = useRef(0);
  useFrame(() => {
    ref.current = clamp(1 - Math.abs(journey.flow - index) / span);
  });
  return ref;
}

export function presenceAt(index: number, span = 1) {
  return clamp(1 - Math.abs(journey.flow - index) / span);
}
