import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { journey } from './journey';

interface UIState {
  /** Project id the camera has pushed into, or null. */
  focus: string | null;
  setFocus: (id: string | null) => void;
  hoveredSkill: string | null;
  setHoveredSkill: (name: string | null) => void;
  resumeOpen: boolean;
  setResumeOpen: (open: boolean) => void;
}

export const UIContext = createContext<UIState | null>(null);

export function UIProvider({ children }: { children: ReactNode }) {
  const [focus, setFocusState] = useState<string | null>(null);
  const [hoveredSkill, setHoveredSkill] = useState<string | null>(null);
  const [resumeOpen, setResumeOpen] = useState(false);

  const value = useMemo<UIState>(
    () => ({
      focus,
      setFocus: (id) => {
        journey.focus = id;
        setFocusState(id);
      },
      hoveredSkill,
      setHoveredSkill,
      resumeOpen,
      setResumeOpen,
    }),
    [focus, hoveredSkill, resumeOpen],
  );

  return <UIContext.Provider value={value}>{children}</UIContext.Provider>;
}

export function useUI() {
  const ctx = useContext(UIContext);
  if (!ctx) throw new Error('useUI must be used inside <UIProvider>');
  return ctx;
}
