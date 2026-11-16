import type { VehicleKind } from '../state';

/** Line icons for the vehicle switcher (24×24, stroke = currentColor). */
const PATHS: Record<VehicleKind, string> = {
  car: 'M3 14.5l1.6-4.3A2 2 0 0 1 6.5 9h9.4a2 2 0 0 1 1.7.9l2.4 3.6 1 .3a1 1 0 0 1 .7 1V17h-2 M3 14.5V17h2 M9 17h6 M5.5 11.8h13 M7 17a2 2 0 1 0 4 0a2 2 0 1 0-4 0 M15 17a2 2 0 1 0 4 0a2 2 0 1 0-4 0',
  bike: 'M2.5 16a3.2 3.2 0 1 0 6.4 0a3.2 3.2 0 1 0-6.4 0 M15.1 16a3.2 3.2 0 1 0 6.4 0a3.2 3.2 0 1 0-6.4 0 M5.7 16l3.3-5.5h5l2.2-3 M14 10.5l4.3 5.5 M9 10.5l3 5.5h3 M15.2 7.5h2.8',
  plane: 'M21 12.5c0-.8-.7-1.5-1.5-1.5H14L10 4H8l2 7H5.5L4 9H2.5l1 3.5-1 3.5H4l1.5-2H10l-2 7h2l4-7h5.5c.8 0 1.5-.7 1.5-1.5z',
  heli: 'M3 5h14 M10 5v3 M6.5 8h7.5a4 4 0 0 1 4 4v.5a1.5 1.5 0 0 1-1.5 1.5H9a3 3 0 0 1-3-3V8z M18 11.5h3.5 M21.5 9.5v4 M8 17v-3 M14 17v-3 M5 17h12',
  boat: 'M3 15l1.5 4h14L21 15H3z M6 15V11h6l3 4 M12 11V6 M12 6l4 3h-4 M2 21c1.5 0 1.5-1 3-1s1.5 1 3 1 1.5-1 3-1 1.5 1 3 1 1.5-1 3-1 1.5 1 3 1',
};

export function VehicleIcon({ kind, size = 24 }: { kind: VehicleKind; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={PATHS[kind]} />
    </svg>
  );
}
