import { useEffect, useRef, type ReactNode } from 'react';

interface SheetProps {
  open: boolean;
  onClose: () => void;
  label: string;
  eyebrow: string;
  children: ReactNode;
}

/** Glass detail panel used for project deep-dives and the resume preview. */
export function Sheet({ open, onClose, label, eyebrow, children }: SheetProps) {
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    panel.current?.focus({ preventScroll: true });
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  return (
    <div className="sheet" data-open={open} role="dialog" aria-modal="false" aria-label={label} aria-hidden={!open}>
      <button
        type="button"
        className="sheet__scrim"
        aria-label="Close panel"
        tabIndex={open ? 0 : -1}
        onClick={onClose}
      />
      <div className="sheet__panel" data-scrollable ref={panel} tabIndex={-1}>
        <div className="sheet__top">
          <span className="mono">{eyebrow}</span>
          <button type="button" className="sheet__close" onClick={onClose} tabIndex={open ? 0 : -1}>
            <b>×</b> CLOSE
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
