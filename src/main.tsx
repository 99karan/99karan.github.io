import { lazy, StrictMode, Suspense } from 'react';
import { createRoot } from 'react-dom/client';

/**
 * Three front doors, one codebase:
 *   /            → the editorial site with the Repo City (default)
 *   /?drive      → the drivable 3D island
 *   /?classic    → the original scroll-driven portfolio
 * Each is its own lazy chunk, so none pays for the others.
 */
const params = new URLSearchParams(window.location.search);

const SiteApp = lazy(() => import('./site/SiteApp'));
const ClassicApp = lazy(() => import('./App'));
const DriveApp = lazy(() => import('./drive/DriveApp'));

const Door = params.has('drive') ? DriveApp : params.has('classic') ? ClassicApp : SiteApp;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Suspense fallback={null}>
      <Door />
    </Suspense>
  </StrictMode>,
);
