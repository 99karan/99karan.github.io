import { useThree } from '@react-three/fiber';

/** Layout hint shared by every island: portrait screens get a different arrangement. */
export function useAspect() {
  const size = useThree((state) => state.size);
  const aspect = size.width / Math.max(1, size.height);
  return { aspect, portrait: aspect < 1, narrow: aspect < 1.35 };
}
