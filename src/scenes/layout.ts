import * as THREE from 'three';
import type { SectionId } from '../data/portfolio';

export type Vec3 = [number, number, number];

/**
 * The world is a single continuous space made of six "islands" the camera
 * travels between. Keeping every coordinate here means the camera path and the
 * content always agree.
 */
export interface Island {
  position: Vec3;
  rotationY: number;
}

export const ISLANDS: Record<SectionId, Island> = {
  hero: { position: [0, 0, 0], rotationY: 0 },
  about: { position: [-7.5, 2.2, -14], rotationY: 0.24 },
  skills: { position: [3.6, 3.2, -31], rotationY: -0.16 },
  projects: { position: [0, 2.7, -49], rotationY: 0 },
  experience: { position: [6, 2.8, -65], rotationY: -0.18 },
  contact: { position: [0, 4.6, -84], rotationY: 0 },
};

export interface CameraKey {
  position: Vec3;
  target: Vec3;
  /** How much further back the camera sits on portrait/narrow screens. */
  portraitPull: number;
  /** Idle orbit amplitude while resting on this section. */
  drift: number;
}

export const CAMERA_KEYS: Record<SectionId, CameraKey> = {
  hero: { position: [0, 1.35, 4.7], target: [0, 1.05, -0.1], portraitPull: 1.55, drift: 0.42 },
  about: { position: [-6.0, 2.6, -6.0], target: [-7.5, 2.15, -14], portraitPull: 1.34, drift: 0.3 },
  skills: { position: [3.05, 3.4, -22.2], target: [3.6, 3.2, -31], portraitPull: 1.5, drift: 0.3 },
  projects: { position: [0, 2.9, -38.5], target: [0, 2.6, -49], portraitPull: 1.3, drift: 0.16 },
  experience: { position: [5.2, 3.2, -56], target: [6, 2.8, -65], portraitPull: 1.36, drift: 0.22 },
  contact: { position: [0, 4.65, -73.2], target: [0, 4.45, -84], portraitPull: 1.36, drift: 0.4 },
};

export const SECTION_KEYS: SectionId[] = ['hero', 'about', 'skills', 'projects', 'experience', 'contact'];

const toVec = (v: Vec3) => new THREE.Vector3(...v);

/** Smooth camera spline through every section anchor. */
export function buildCameraCurves() {
  const positions = SECTION_KEYS.map((id) => toVec(CAMERA_KEYS[id].position));
  const targets = SECTION_KEYS.map((id) => toVec(CAMERA_KEYS[id].target));
  const position = new THREE.CatmullRomCurve3(positions, false, 'catmullrom', 0.28);
  const target = new THREE.CatmullRomCurve3(targets, false, 'catmullrom', 0.28);
  return { position, target };
}

/* ------------------------------------------------------------------ */
/* Projects gallery — a cylindrical arc centred on the viewer          */
/* ------------------------------------------------------------------ */

export interface Slot {
  position: Vec3;
  rotationY: number;
  scale: number;
}

const GALLERY_RADIUS = 12;
const GALLERY_PIVOT_Z = 10.5; // island-local z of the resting camera

export function projectSlots(count: number, portrait: boolean): Slot[] {
  const angles = portrait
    ? [-0.105, 0.105, -0.105, 0.105]
    : [-0.4, -0.135, 0.135, 0.4];
  const heights = portrait ? [2.35, 2.35, -2.35, -2.35] : [0, 0, 0, 0];
  const scale = portrait ? 0.72 : 1;

  return Array.from({ length: count }, (_, i) => {
    const a = angles[i % angles.length];
    return {
      position: [
        Math.sin(a) * GALLERY_RADIUS,
        heights[i % heights.length],
        GALLERY_PIVOT_Z - Math.cos(a) * GALLERY_RADIUS,
      ] as Vec3,
      rotationY: a,
      scale,
    };
  });
}

/** Camera pose used when a project is opened, in world space. */
export function projectFocusPose(slot: Slot) {
  const island = ISLANDS.projects;
  const local = new THREE.Vector3(...slot.position);
  const world = local.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), island.rotationY);
  world.add(new THREE.Vector3(...island.position));

  const forward = new THREE.Vector3(0, 0, 1)
    .applyAxisAngle(new THREE.Vector3(0, 1, 0), slot.rotationY + island.rotationY)
    .multiplyScalar(4.4 * (slot.scale < 1 ? 0.95 : 1));

  return {
    position: world.clone().add(forward).add(new THREE.Vector3(0, 0.35, 0)),
    target: world.clone().add(new THREE.Vector3(0, 0.1, 0)),
  };
}

/* ------------------------------------------------------------------ */
/* Experience timeline                                                 */
/* ------------------------------------------------------------------ */

export const TIMELINE_SPAN = 11.5;

export const TIMELINE_SPAN_PORTRAIT = 8.6;

/** Horizontal on wide screens, vertical on phones — same walk, different axis. */
export function timelineNode(index: number, count: number, portrait: boolean): Vec3 {
  const t = count <= 1 ? 0.5 : index / (count - 1);
  if (portrait) {
    return [Math.sin(t * Math.PI) * 0.5 - 0.2, (0.5 - t) * TIMELINE_SPAN_PORTRAIT, -t * 2.2];
  }
  return [(t - 0.5) * TIMELINE_SPAN, Math.sin(t * Math.PI) * 0.55 - 0.25, -t * 3.2];
}

/** Island-local offset applied to the camera as it travels the timeline. */
export function timelineCameraOffset(t: number, portrait: boolean): Vec3 {
  if (portrait) return [0, (0.5 - t) * TIMELINE_SPAN_PORTRAIT * 0.86, -t * 1.8];
  return [(t - 0.5) * TIMELINE_SPAN * 0.78, Math.sin(t * Math.PI) * 0.32, -t * 2.4];
}

/** Resume document sits at the end of the timeline walk. */
export const RESUME_ANCHOR: Vec3 = [6.55, 0.35, 1.5];
export const RESUME_ANCHOR_PORTRAIT: Vec3 = [0, -5.35, 1.2];
