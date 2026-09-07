export const PALETTE = {
  ink: '#05070b',
  inkDeep: '#04060a',
  panel: '#0b1017',
  text: '#e8ecf4',
  dim: '#8a93a6',
  faint: '#5b6577',
  accent: '#66e0c0',
  blue: '#8ab6ff',
  amber: '#ffb46a',
} as const;

export const rgba = (hex: string, alpha: number) => {
  const v = hex.replace('#', '');
  const n = parseInt(v.length === 3 ? v.split('').map((c) => c + c).join('') : v, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
};

export const display = (size: number, weight = 400) =>
  `${weight} ${size}px "Space Grotesk", "Inter", system-ui, sans-serif`;

export const mono = (size: number, weight = 400) =>
  `${weight} ${size}px "JetBrains Mono", ui-monospace, Menlo, monospace`;
