import { createContext, useContext, type ReactNode } from 'react';
import type { Quality } from './useQuality';

export const QualityContext = createContext<Quality | null>(null);

export function QualityProvider({ value, children }: { value: Quality; children: ReactNode }) {
  return <QualityContext.Provider value={value}>{children}</QualityContext.Provider>;
}

export function useQualityContext(): Quality {
  const value = useContext(QualityContext);
  if (!value) throw new Error('useQualityContext must be used inside <QualityProvider>');
  return value;
}
