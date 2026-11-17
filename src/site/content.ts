/**
 * Everything the main page says. Edit this file to change the copy.
 *
 * `bone` strings are the "x-ray" layer: the spec underneath a finished
 * sentence, shown where the cursor passes over it. Keep them short,
 * lowercase `key: value` lines.
 */
import { profile, socials } from '../data/portfolio';

export const site = {
  name: 'Karan Prajapat',
  first: 'Karan',
  last: 'Prajapat',
  status: 'Open to Flutter & mobile roles · remote or on-site',
  lead: 'Flutter & mobile developer. I build apps for iOS and Android that see, track and sync: on-device computer vision, real-time networking, and the polish that makes them feel native.',
  leadBone: `role: flutter developer
core: flutter, dart, riverpod, mvvm
also: c++, python, typescript, three.js
ships_to: ios, android, macos, web
based_in: jodhpur, india`,
  hint: 'Move your cursor over any text to x-ray it.',
  email: profile.email,
  resume: profile.resume.file,
  location: 'Jodhpur, Rajasthan · available worldwide',
};

export const manifesto = {
  text: 'Apps are judged in the hand, not in the pull request.',
  bone: `requirement: it works on a real phone
constraint: 60fps, offline, bad network`,
};

export const principles = [
  {
    title: 'Architecture that stays readable',
    text: 'Feature-first folders, Riverpod state and MVVM, so the tenth feature is as easy to add as the first, and every rule is testable without a screen.',
    bone: `state: riverpod, split per feature
layers: view → viewmodel → repository
tests: logic without widgets`,
  },
  {
    title: 'Real-time, or it feels broken',
    text: 'Detection runs on isolates, painting runs on the display ticker, and the UI never waits on the network. Smooth is a requirement, not a polish pass.',
    bone: `heavy_work: dart isolates
paint: custom painter @ display rate
budget: 16ms a frame`,
  },
  {
    title: 'Intelligence on the device',
    text: 'TFLite models and classic vision running on the phone itself: tracking a ball or a marble frame by frame, with no server in the loop.',
    bone: `inference: tflite_flutter
vision: per-frame detection
privacy: footage never leaves the phone`,
  },
  {
    title: 'Ship the whole thing',
    text: 'Flavours, CI builds, store submissions and the release after that. The unglamorous last mile is where an app becomes a product.',
    bone: `build: flavours, ci
release: play store, app store
after: crash logs, fixes, next version`,
  },
];

export type StageKind = 'trail' | 'trajectory' | 'lan' | 'ludo';

export interface Chapter {
  id: string;
  /** The GitHub repo this chapter is about: links it to its building in the city. */
  repo: string;
  title: string;
  meta: string;
  lead: string;
  bone: string;
  wins: string[];
  stack: string;
  stage: StageKind;
  tags: { label: string; u: number; v: number; hot?: boolean }[];
}

export const chapters: Chapter[] = [
  {
    id: 'shot-tracing',
    repo: 'shot_tracing',
    title: 'Shot Tracing',
    meta: 'Real-time golf ball tracking for iOS and Android',
    lead: 'Point a phone at a golf shot and watch the ball leave a glowing trail across the live camera feed, with distance stats for every shot.',
    bone: `camera: live stream, every 2nd frame
detect: tflite on a dedicated isolate
filter: confidence ≥ 0.5
trail: last 25 points, 3-layer glow
gaps: interpolated when the ball is lost`,
    wins: [
      'Detection moved off the UI thread onto an isolate, so the camera preview never stutters.',
      'A three-layer painter (blur, glow, core) gives the trail its broadcast look at display rate.',
      'Shots are segmented automatically: a new trail starts per shot and clears when the ball stops.',
    ],
    stack: 'Flutter, Dart, TFLite, camera, Isolates, CustomPainter',
    stage: 'trail',
    tags: [
      { label: 'Tee', u: 0.12, v: 0.86 },
      { label: 'SHOT DETECTED', u: 0.62, v: 0.12, hot: true },
    ],
  },
  {
    id: 'trajectory',
    repo: 'object_trajectory_tracking',
    title: 'Object Trajectory Tracking',
    meta: 'Record, detect and replay the path of a moving object',
    lead: 'Film a marble rolling, falling or bouncing. The app finds it in every frame and draws the exact path it travelled back over the footage.',
    bone: `stages: record → process → visualize
detect: dark + circular, per frame
points: (x, y, t) per frame
replay: path grows with playback
layout: feature-based mvvm`,
    wins: [
      'Record, process and visualize are separate stages, so the detector can be swapped without touching playback.',
      'Each detected centre is time-stamped, ready for velocity and acceleration overlays.',
      'The replay builds the line in sync with the video, so you see exactly where the object went.',
    ],
    stack: 'Flutter, Dart, Swift, Kotlin, C++, CustomPainter, MVVM',
    stage: 'trajectory',
    tags: [
      { label: 'frame 0', u: 0.14, v: 0.2 },
      { label: 'path', u: 0.78, v: 0.82, hot: true },
    ],
  },
  {
    id: 'lan',
    repo: 'lan_api_tool',
    title: 'LAN API Tool',
    meta: 'A Postman-style API client that syncs across devices on your network',
    lead: 'Send requests from one machine, see them on the next. Devices find each other over mDNS and keep request history in sync over TCP.',
    bone: `client: dio (get, post, put, delete)
storage: hive, local history
discover: mdns on the lan
sync: tcp sockets, real time
state: riverpod`,
    wins: [
      'Zero-config discovery: devices on the same network appear on their own.',
      'Request history persists locally, so it works offline and syncs when peers return.',
      'Desktop-first Flutter build for macOS and Windows.',
    ],
    stack: 'Flutter Desktop, Dart, Dio, Hive, Riverpod, mDNS, TCP sockets',
    stage: 'lan',
    tags: [
      { label: 'macOS', u: 0.22, v: 0.45 },
      { label: 'Windows', u: 0.8, v: 0.86 },
      { label: 'synced', u: 0.5, v: 0.08, hot: true },
    ],
  },
  {
    id: 'ludo',
    repo: 'ludo-multiplayer',
    title: 'Ludo Multiplayer',
    meta: 'A VS Code extension: play Ludo with friends on your network',
    lead: 'A full Ludo board inside a VS Code panel, with a local Socket.IO server so two to four people on the same network can play in real time.',
    bone: `host: vs code webview panel
server: socket.io, local
players: 2–4 on the lan
rules: dice, captures, home column, win`,
    wins: [
      'The whole game runs inside the editor: no browser tab, no account.',
      'Real-time moves over Socket.IO with the full ruleset, captures and win detection.',
    ],
    stack: 'JavaScript, VS Code Extension API, Webviews, Socket.IO',
    stage: 'ludo',
    tags: [{ label: 'your move', u: 0.5, v: 0.04, hot: true }],
  },
];

export const journey = [
  {
    period: '2024 — now',
    role: 'Flutter Developer',
    org: 'Product work',
    detail:
      'Building and maintaining production Flutter apps end to end: architecture, state management, API integration and release. On the side, on-device vision apps like Shot Tracing and Object Trajectory Tracking.',
    bone: `stack: flutter, riverpod, firebase
own: architecture → store release`,
  },
  {
    period: '2023 — 2024',
    role: 'Software Developer',
    org: 'Applications & APIs',
    detail:
      'Moved from feature work into architecture: MVVM structure, typed API layers, caching strategies and reusable UI systems.',
    bone: `shift: features → architecture
built: typed api layer, ui kit`,
  },
  {
    period: '2022 — 2023',
    role: 'Foundations',
    org: 'Systems & experiments',
    detail: 'C++ and Python fundamentals, data structures, and the first mobile projects, where the habit of shipping started.',
    bone: `learned: c++, python, dsa
first: shipped mobile projects`,
  },
  {
    period: 'Next',
    role: 'Your team?',
    org: 'Open to roles',
    detail: 'Looking for a team that ships mobile products people use every day, and cares how they feel in the hand.',
    bone: `looking_for: product team
remote: yes`,
  },
];

export const contact = {
  title: "Let's build something.",
  body: 'Interesting products, hard problems and teams that ship. The fastest way to reach me is email.',
  links: socials.filter((s) => s.id !== 'email'),
};
