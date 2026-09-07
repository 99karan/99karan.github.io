# Karan Prajapat — Interactive 3D Portfolio

A scroll-driven 3D portfolio built as one continuous space. The visitor starts
at a futuristic workstation floating in the dark, and scrolling flies the camera
through six islands — workspace, profile, an orbiting skill system, a project
gallery, a timeline, and an open room to make contact.

**Stack:** React 18 · TypeScript · Three.js · React Three Fiber · Drei ·
postprocessing · GSAP · Vite.

---

## 1. Install dependencies

```bash
npm install
```

Node 18+ (Node 20 recommended).

## 2. Run locally

```bash
npm run dev        # http://localhost:5173
npm run typecheck  # TypeScript, no emit
npm run build      # type-check + production bundle into dist/
npm run preview    # serve the production build locally
```

---

## 3. How the project is organised

```
src/
├─ animations/      easing, damping, the plateau curve that paces the journey
├─ components/      DOM layer: loader, nav, panels, sheets, error boundary
├─ data/portfolio.ts  ← ALL CONTENT LIVES HERE
├─ hooks/           device tier, scroll journey, aspect, textures, scroll lock
├─ lib/             canvas-texture engine + every screen/panel drawing
├─ models/          3D objects: workstation parts, islands, shared primitives
├─ scenes/          camera rig, lighting, space, post-processing, world layout
├─ sections/        the HTML copy for each section
├─ state/           journey (per-frame, non-React) + UI context (React)
└─ styles/          design tokens and CSS
```

Two ideas are worth knowing before editing:

- **`src/state/journey.ts`** is a plain mutable object, deliberately *not* React
  state. Scroll position, pointer, and section blend change every frame; pushing
  them through React would re-render the tree 60× a second. Components that care
  about discrete changes subscribe (`useJourneyIndex`, `useUI`).
- **`src/scenes/layout.ts`** is the single source of truth for world space. Every
  island position, camera keyframe and gallery slot is declared there, so the
  camera path and the content can never drift apart.

---

## 4. Adding 3D models (GLB/GLTF)

Everything you see is procedural geometry — no model downloads, which is why the
scene boots fast. To bring in a real model:

1. Compress it first (Draco or Meshopt), then drop it in `public/models/`:

   ```bash
   npx gltf-transform optimize input.glb public/models/workstation.glb \
     --compress draco --texture-compress webp
   ```

2. Render it with the ready-made slot, inside the scene's `<Suspense>`:

   ```tsx
   import { GLTFModel } from './models/GLTFModel';

   <GLTFModel url="./models/workstation.glb" position={[0, 0, 0]} scale={0.5} />
   ```

3. Optional: preload it so it is fetched during the loading screen — the loader
   already tracks Drei's progress:

   ```tsx
   import { useGLTF } from '@react-three/drei';
   useGLTF.preload('./models/workstation.glb');
   ```

Keep paths relative (`./models/...`) so they survive the GitHub Pages base path.
Budget: aim under ~1.5 MB per model and 2 texture sets, or mobile will suffer.

## 5. Adding / editing projects

Edit the `projects` array in [`src/data/portfolio.ts`](src/data/portfolio.ts):

```ts
{
  id: 'my-project',              // unique, used by the camera focus
  title: 'My Project',
  index: '05',
  tagline: 'One line that sells it',
  description: 'Shown in the gallery and at the top of the case study.',
  detail: 'The longer paragraph in the opened panel.',
  highlights: ['Bullet one', 'Bullet two'],
  tech: ['Flutter', 'Firebase'],
  accent: '#66e0c0',             // drives the screen glow and rim light
  mock: 'app',                   // 'app' | 'terminal' | 'canvas' | 'grid'
  image: './projects/my-project.jpg',   // optional, see below
  github: 'https://github.com/…',
  demo: 'https://…',             // optional — button only shows when present
}
```

- **Screenshots:** drop a 16:10 image (1280×800 works well) in
  `public/projects/` and point `image` at it. If the file is missing, the scene
  falls back to the generated mock — it never breaks.
- **Layout:** the gallery arranges itself. Four projects give the widescreen arc
  and the 2×2 phone grid; more than four keep cycling those slots, so adjust
  `projectSlots()` in `src/scenes/layout.ts` if you go past four.
- Skills, milestones and stats live in the same file and behave the same way.

## 6. Adding the resume

1. Save your PDF to `public/resume/karan-prajapat-resume.pdf`.
2. If you name it differently, update `profile.resume.file` in
   `src/data/portfolio.ts` (keep the leading `./`).

Two entry points already exist: the floating document at the end of the 3D
timeline, and the "Download resume" button in the hero. Both open an in-page
preview generated from `portfolio.ts`, with the PDF download beneath it — so the
preview stays correct even before you add the file.

## 7. GitHub / LinkedIn / email links

All three live in the `socials` array in `src/data/portfolio.ts`:

```ts
export const socials = [
  { id: 'github',   label: 'GitHub',   handle: '@99karan',          url: 'https://github.com/99karan' },
  { id: 'linkedin', label: 'LinkedIn', handle: 'in/karan-prajapat', url: 'https://www.linkedin.com/in/karan-prajapat-47a068175' },
  { id: 'email',    label: 'Email',    handle: profile.email,       url: `mailto:${profile.email}` },
];
```

Change the URLs (and `profile.email`) and every surface updates at once: the 3D
icons in the contact room, the header link, the contact panel and the resume
preview. The `id` picks which icon is drawn, so keep those three ids.

## 8. Build for production

```bash
npm run build     # → dist/
npm run preview   # verify the exact bundle you are about to ship
```

`vite.config.ts` sets `base: './'`, so the build works both at a domain root and
under a sub-path. Vendor code is split into `three` / `r3f` / `post` / `gsap`
chunks so a content edit does not invalidate the whole cache.

## 9. Deploy to GitHub Pages

A workflow is included at `.github/workflows/deploy.yml`.

```bash
git add -A
git commit -m "Interactive 3D portfolio"
git push origin main
```

Then in the repository: **Settings → Pages → Build and deployment → Source:
GitHub Actions**. Every push to `main` builds and publishes automatically.

Because the repository is `99karan.github.io`, the site is served at
<https://99karan.github.io>. For a *project* repository the same build works
unchanged — `base: './'` handles the `/repo-name/` prefix.

<details>
<summary>Manual alternative (no Actions)</summary>

```bash
npm run build
npx gh-pages -d dist          # publishes dist/ to the gh-pages branch
```
Then set Pages → Source → `gh-pages` branch.
</details>

---

## Diagnosing a soft or slow render

Add `?debug=1` to the URL. The overlay reports the device tier, the display's
pixel ratio, the ratio actually being rendered at, and the canvas buffer size.
If `render dpr` is flagged `THROTTLED`, the GPU could not hold frame rate and
the renderer stepped down — depth of field is dropped first, resolution last.
`?quality=low|mid|high` forces a tier.

## Performance notes

- **Device tiers** (`src/hooks/useQuality.ts`) score CPU cores, device memory,
  screen pixels and input type into `low` / `mid` / `high`, which decides pixel
  ratio caps, shadows, particle counts, texture resolution, prop meshes and the
  post-processing chain. Renderer-level flags are chosen once, at mount.
- **Adaptive resolution:** Drei's `PerformanceMonitor` lowers the pixel ratio on
  sustained frame drops instead of degrading the composition.
- **Island culling:** each section's content is hidden once the camera is more
  than ~1.5 sections away — invisible groups cost nothing to draw or raycast.
- **Disposal:** every canvas texture, geometry and loaded image is disposed with
  its component; nothing is cached globally.
- **Mobile** is a different arrangement, not a shrunk desktop: the project
  gallery becomes a 2×2 grid, the timeline runs vertically, post-processing drops
  to bloom + vignette, particle counts fall by ~4×, and the DOM copy that the 3D
  layer normally carries (the name, the stats, the milestone list) becomes
  visible because 3D type is too small to read on a phone.
- **No WebGL?** `SceneBoundary` drops the canvas and the DOM layer — which holds
  every word of the portfolio — stands on its own.

## Accessibility

Copy lives in the DOM, not in WebGL, so it stays selectable and readable by
assistive tech. The floating rail is real `<button>`s, panels are `<section>`s
that toggle `aria-hidden`, sheets close on Escape, and
`prefers-reduced-motion` is respected in CSS.
