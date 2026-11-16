import { lazy, StrictMode, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/index.css';

/**
 * Two front doors, one codebase:
 *   /            → the drivable island (default)
 *   /?classic    → the original scroll-driven portfolio
 * Each is its own lazy chunk, so neither pays for the other.
 */
const params = new URLSearchParams(window.location.search);
const classic = params.has('classic');

const ClassicApp = lazy(() => import('./App'));
const DriveApp = lazy(() => import('./drive/DriveApp'));

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Suspense fallback={null}>{classic ? <ClassicApp /> : <DriveApp />}</Suspense>
  </StrictMode>,
);
