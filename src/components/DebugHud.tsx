import { useEffect, useState } from 'react';
import type { Quality } from '../hooks/useQuality';

/**
 * `?debug=1` — reports what the renderer actually settled on.
 *
 * Perceived blur is almost always one of three things: a device tier below
 * what the machine can handle, a pixel ratio that has been throttled below the
 * display's own, or a canvas whose backing store is smaller than its CSS box.
 * All three are visible here.
 */
export function DebugHud({ quality }: { quality: Quality }) {
  const [info, setInfo] = useState<string[]>([]);

  useEffect(() => {
    const read = () => {
      const canvas = document.querySelector('canvas');
      const buffer = canvas ? `${canvas.width}×${canvas.height}` : '—';
      const css = canvas ? `${canvas.clientWidth}×${canvas.clientHeight}` : '—';
      const effective = canvas && canvas.clientWidth ? (canvas.width / canvas.clientWidth).toFixed(2) : '—';
      setInfo([
        `tier        ${quality.tier}`,
        `display dpr ${window.devicePixelRatio}`,
        `render  dpr ${effective}${Number(effective) < window.devicePixelRatio - 0.05 ? '  ← THROTTLED' : '  ok'}`,
        `dpr range   ${quality.dpr[0]} – ${quality.dpr[1]}`,
        `buffer      ${buffer}`,
        `css         ${css}`,
        `dof/shadows ${quality.dof ? 'on' : 'off'} / ${quality.shadows ? 'on' : 'off'}`,
        `cores/mem   ${navigator.hardwareConcurrency ?? '?'} / ${
          (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? '?'
        }`,
      ]);
    };
    read();
    const timer = window.setInterval(read, 1000);
    return () => window.clearInterval(timer);
  }, [quality]);

  return (
    <pre
      style={{
        position: 'fixed',
        left: 12,
        bottom: 12,
        zIndex: 60,
        margin: 0,
        padding: '10px 12px',
        font: '11px/1.5 ui-monospace, monospace',
        color: '#66e0c0',
        background: 'rgba(4,6,10,0.86)',
        border: '1px solid rgba(102,224,192,0.3)',
        borderRadius: 2,
        pointerEvents: 'none',
        whiteSpace: 'pre',
      }}
    >
      {info.join('\n')}
    </pre>
  );
}
