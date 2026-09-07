/**
 * Single source of truth for every piece of portfolio content.
 * Edit this file to update the site — no component changes required.
 */

export type SectionId = 'hero' | 'about' | 'skills' | 'projects' | 'experience' | 'contact';

export interface Skill {
  name: string;
  detail: string;
  /** Ring the skill orbits on: 0 = inner, 1 = middle, 2 = outer. */
  ring: 0 | 1 | 2;
  accent: string;
}

export interface Project {
  id: string;
  title: string;
  index: string;
  tagline: string;
  description: string;
  detail: string;
  highlights: string[];
  tech: string[];
  accent: string;
  /** Optional screenshot in /public/projects. Falls back to a generated UI mock. */
  image?: string;
  /** Visual template used for the generated mock when no image is supplied. */
  mock: 'app' | 'terminal' | 'canvas' | 'grid';
  github?: string;
  demo?: string;
}

export interface Milestone {
  id: string;
  period: string;
  role: string;
  org: string;
  detail: string;
  tags: string[];
}

export const profile = {
  name: 'KARAN PRAJAPAT',
  firstName: 'Karan',
  role: 'Flutter Developer • Software Engineer',
  tagline: 'Building products, experimenting with technology, and turning ideas into software.',
  location: 'India — available worldwide',
  email: 'hello@karanprajapat.dev',
  resume: {
    /** Drop your PDF at public/resume/karan-prajapat-resume.pdf */
    file: './resume/karan-prajapat-resume.pdf',
    updated: 'Updated 2026',
  },
  about: {
    heading: 'WHO AM I?',
    body: "I'm a Flutter developer who enjoys building polished applications, working with APIs and backend systems, and exploring new areas of software development.",
    secondary:
      'I care about the small details — motion that feels right, architecture that stays readable, and interfaces that respect the person using them.',
  },
  contact: {
    heading: "LET'S BUILD SOMETHING",
    body: "I'm always interested in interesting products, technology, and challenging problems.",
  },
} as const;

export const stats = [
  { value: '2+', label: 'Years Experience', note: 'Shipping production Flutter' },
  { value: 'Flutter', label: 'Core Craft', note: 'Dart · Riverpod · MVVM' },
  { value: 'Multiple', label: 'Projects', note: 'Apps, tools, experiments' },
  { value: '∞', label: 'Always Learning', note: 'Backend, 3D, systems' },
] as const;

export const navigation: { id: SectionId; label: string; index: string }[] = [
  { id: 'about', label: 'ABOUT', index: '01' },
  { id: 'skills', label: 'SKILLS', index: '02' },
  { id: 'projects', label: 'PROJECTS', index: '03' },
  { id: 'experience', label: 'EXPERIENCE', index: '04' },
  { id: 'contact', label: 'CONTACT', index: '05' },
];

export const skills: Skill[] = [
  { name: 'Flutter', detail: 'Cross-platform interfaces with real polish', ring: 0, accent: '#66e0c0' },
  { name: 'Dart', detail: 'Expressive, maintainable application logic', ring: 0, accent: '#66e0c0' },
  { name: 'Riverpod', detail: 'Predictable, testable reactive state', ring: 0, accent: '#8ab6ff' },
  { name: 'Firebase', detail: 'Auth, Firestore and realtime foundations', ring: 1, accent: '#ffb46a' },
  { name: 'REST APIs', detail: 'Resilient data layers and clean contracts', ring: 1, accent: '#8ab6ff' },
  { name: 'MVVM', detail: 'Architecture that scales past one developer', ring: 1, accent: '#66e0c0' },
  { name: 'Python', detail: 'Automation, data work and trading experiments', ring: 1, accent: '#ffb46a' },
  { name: 'C++', detail: 'Systems-level fundamentals and performance', ring: 2, accent: '#8ab6ff' },
  { name: 'Three.js', detail: 'Spatial, cinematic interfaces on the web', ring: 2, accent: '#66e0c0' },
  { name: 'Git', detail: 'Clean history, reviewable, collaborative work', ring: 2, accent: '#ffb46a' },
];

export const projects: Project[] = [
  {
    id: 'fincard',
    title: 'FinCard',
    index: '01',
    tagline: 'Financial education, made tangible',
    description:
      'A financial education and productivity application that turns money habits into something you can actually see and act on.',
    detail:
      'FinCard breaks personal finance into short, card-sized lessons and pairs them with a lightweight tracker. Built with a Riverpod + MVVM architecture so the learning engine, tracking and sync layers stay independent and testable.',
    highlights: [
      'Card-based learning flow with offline-first persistence',
      'Riverpod state layer split by feature, fully unit-testable',
      'Firebase auth, Firestore sync and push reminders',
    ],
    tech: ['Flutter', 'Dart', 'Riverpod', 'Firebase', 'MVVM'],
    accent: '#66e0c0',
    mock: 'app',
    github: 'https://github.com/99karan',
  },
  {
    id: 'trading',
    title: 'Algorithmic Trading',
    index: '02',
    tagline: 'Python trading experiments & automation',
    description:
      'A research playground for market data: strategy backtests, signal generation and automation scripts.',
    detail:
      'A set of Python notebooks and services for pulling market data, backtesting rule-based strategies and automating the boring parts. Focused on measurement — every strategy reports drawdown, exposure and hit rate before it goes anywhere near live data.',
    highlights: [
      'Vectorised backtesting over historical OHLCV data',
      'Broker/data APIs wrapped behind one typed interface',
      'Scheduled jobs with alerting and run-by-run reporting',
    ],
    tech: ['Python', 'Pandas', 'REST APIs', 'Automation'],
    accent: '#ffb46a',
    mock: 'terminal',
    github: 'https://github.com/99karan',
  },
  {
    id: 'spatial',
    title: '3D Web Experiments',
    index: '03',
    tagline: 'Interactive Three.js studies',
    description:
      'A growing collection of Three.js scenes exploring depth, motion, shaders and spatial storytelling on the web.',
    detail:
      'Small, focused WebGL studies — custom shader materials, GPU particles, scroll-driven cinematography and post-processing. This portfolio itself came out of that practice.',
    highlights: [
      'React Three Fiber scene graphs with strict resource disposal',
      'Scroll-driven camera splines and damped interpolation',
      'Adaptive quality tiers for low-end and mobile devices',
    ],
    tech: ['Three.js', 'React', 'GLSL', 'GSAP'],
    accent: '#8ab6ff',
    mock: 'canvas',
    github: 'https://github.com/99karan',
    demo: 'https://99karan.github.io',
  },
  {
    id: 'flutter-apps',
    title: 'Flutter Applications',
    index: '04',
    tagline: 'Production mobile products',
    description:
      'Mobile applications built with Flutter — from API-driven product apps to internal tools and client work.',
    detail:
      'A body of shipped Flutter work: authentication and onboarding, REST integrations, offline caching, custom motion, and release pipelines for both Android and iOS.',
    highlights: [
      'Feature-first project structure with shared design system',
      'Custom implicit/explicit animations and page transitions',
      'CI builds, flavour configs and store release workflow',
    ],
    tech: ['Flutter', 'Dart', 'REST APIs', 'Firebase'],
    accent: '#66e0c0',
    mock: 'grid',
    github: 'https://github.com/99karan',
  },
];

export const milestones: Milestone[] = [
  {
    id: 'm1',
    period: '2024 — NOW',
    role: 'Flutter Developer',
    org: 'Product work',
    detail:
      'Building and maintaining production Flutter applications end to end — architecture, state management, API integration and release.',
    tags: ['Flutter', 'Riverpod', 'Firebase'],
  },
  {
    id: 'm2',
    period: '2023 — 2024',
    role: 'Software Developer',
    org: 'Applications & APIs',
    detail:
      'Moved from feature work into architecture: MVVM structure, typed API layers, caching strategies and reusable UI systems.',
    tags: ['Dart', 'REST APIs', 'MVVM'],
  },
  {
    id: 'm3',
    period: '2022 — 2023',
    role: 'Foundations',
    org: 'Systems & experiments',
    detail:
      'C++ and Python fundamentals, data structures, and the first mobile projects — where the habit of shipping started.',
    tags: ['C++', 'Python', 'Git'],
  },
  {
    id: 'm4',
    period: 'ONGOING',
    role: 'Always Learning',
    org: 'Backend · 3D · Systems',
    detail:
      'Currently going deeper into backend systems, algorithmic trading and real-time 3D on the web.',
    tags: ['Three.js', 'Backend', 'Trading'],
  },
];

export const socials = [
  { id: 'github', label: 'GitHub', handle: '@99karan', url: 'https://github.com/99karan' },
  {
    id: 'linkedin',
    label: 'LinkedIn',
    handle: 'in/karanprajapat',
    url: 'https://www.linkedin.com/in/karanprajapat',
  },
  { id: 'email', label: 'Email', handle: profile.email, url: `mailto:${profile.email}` },
] as const;

export const sectionOrder: SectionId[] = ['hero', 'about', 'skills', 'projects', 'experience', 'contact'];
