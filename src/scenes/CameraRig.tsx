import { useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { journey, LAST_SECTION } from '../state/journey';
import { clamp, damp } from '../animations/easing';
import {
  CAMERA_KEYS,
  ISLANDS,
  projectFocusPose,
  projectSlots,
  sampleCameraPath,
  SECTION_KEYS,
  timelineCameraOffset,
} from './layout';
import { projects } from '../data/portfolio';
import { focusPoint } from './focus';
import { useUI } from '../state/ui';

const UP = new THREE.Vector3(0, 1, 0);

/**
 * Drives the camera along a Catmull-Rom spline threaded through every section
 * anchor, then layers idle drift, mouse parallax and — when a project is
 * opened — a blended "push in" pose on top. Everything is damped, so scroll
 * flings and nav jumps still resolve as smooth cinematic moves.
 */
export function CameraRig({ portrait }: { portrait: boolean }) {
  const { camera } = useThree();
  const { focus } = useUI();

  const pos = useRef(new THREE.Vector3(...CAMERA_KEYS.hero.position));
  const look = useRef(new THREE.Vector3(...CAMERA_KEYS.hero.target));
  const scratch = useMemo(
    () => ({
      p: new THREE.Vector3(),
      t: new THREE.Vector3(),
      dir: new THREE.Vector3(),
      right: new THREE.Vector3(),
      up: new THREE.Vector3(),
      focusP: new THREE.Vector3(),
      focusT: new THREE.Vector3(),
      offset: new THREE.Vector3(),
      quat: new THREE.Quaternion(),
      mat: new THREE.Matrix4(),
    }),
    [],
  );

  const focusPose = useMemo(() => {
    if (!focus) return null;
    const index = projects.findIndex((p) => p.id === focus);
    if (index < 0) return null;
    return projectFocusPose(projectSlots(projects.length, portrait)[index]);
  }, [focus, portrait]);

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.1);
    const { p, t: tgt, dir, right, up, focusP, focusT, offset, quat, mat } = scratch;

    sampleCameraPath(journey.flow, p, tgt);

    // Section-aware framing: pull back on narrow viewports so the island fits.
    const nearest = SECTION_KEYS[Math.min(LAST_SECTION, Math.max(0, Math.round(journey.flow)))];
    const key = CAMERA_KEYS[nearest];
    if (portrait) {
      dir.copy(p).sub(tgt);
      const pull = 1 + (key.portraitPull - 1) * journey.local;
      p.copy(tgt).add(dir.multiplyScalar(pull));
      p.y += 0.3 * journey.local;
      // Aiming lower lifts the island into the top half of a tall screen,
      // leaving the bottom for the copy block.
      tgt.y -= 0.85 * journey.local;
    }

    // Travelling shot along the experience timeline.
    const timelineIndex = SECTION_KEYS.indexOf('experience');
    const onTimeline = clamp(1 - Math.abs(journey.flow - timelineIndex) / 0.9);
    if (onTimeline > 0.001) {
      const band = clamp(journey.travel * LAST_SECTION - (timelineIndex - 0.5));
      const [ox, oy, oz] = timelineCameraOffset(band, portrait);
      const island = ISLANDS.experience;
      offset.set(ox, oy, oz).multiplyScalar(onTimeline).applyAxisAngle(UP, island.rotationY);
      p.add(offset);
      tgt.addScaledVector(offset, 0.82);
    }

    // Idle cinematic drift + mouse parallax, strongest when settled.
    const time = state.clock.elapsedTime;
    const settle = journey.local;
    const drift = key.drift * settle;
    dir.copy(tgt).sub(p).normalize();
    right.copy(dir).cross(UP).normalize();
    up.copy(right).cross(dir).normalize();

    const parallaxX = journey.pointer.x * (0.62 + drift * 0.6) * settle;
    const parallaxY = -journey.pointer.y * (0.34 + drift * 0.3) * settle;

    p.addScaledVector(right, Math.sin(time * 0.16) * drift * 0.55 + parallaxX);
    p.addScaledVector(up, Math.sin(time * 0.21 + 1.3) * drift * 0.32 + parallaxY);
    tgt.addScaledVector(right, parallaxX * 0.18);
    tgt.addScaledVector(up, parallaxY * 0.18);

    // Blend into the focused project pose.
    if (focusPose && journey.focusBlend > 0.001) {
      const b = journey.focusBlend;
      focusP.copy(focusPose.position);
      focusT.copy(focusPose.target);
      p.lerp(focusP, b);
      tgt.lerp(focusT, b);
    }

    const lambda = journey.focusBlend > 0.01 ? 3.4 : 4.2;
    pos.current.copy(p);
    look.current.x = damp(look.current.x, tgt.x, lambda, dt);
    look.current.y = damp(look.current.y, tgt.y, lambda, dt);
    look.current.z = damp(look.current.z, tgt.z, lambda, dt);

    camera.position.x = damp(camera.position.x, pos.current.x, lambda, dt);
    camera.position.y = damp(camera.position.y, pos.current.y, lambda, dt);
    camera.position.z = damp(camera.position.z, pos.current.z, lambda, dt);

    focusPoint.copy(look.current);

    mat.lookAt(camera.position, look.current, UP);
    quat.setFromRotationMatrix(mat);
    camera.quaternion.slerp(quat, 1 - Math.exp(-6 * dt));
  });

  return null;
}
