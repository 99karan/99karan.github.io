import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { runtime, store, type VehicleKind } from './state';
import { groundAt, WATER_LEVEL } from './world/map';

/** [distance, height, look-up] behind each vehicle. */
const RIG: Record<VehicleKind, [number, number, number]> = {
  car: [8.4, 3.0, 1.3],
  bike: [6.4, 2.5, 1.3],
  plane: [17, 4.6, 2.4],
  heli: [16, 5.6, 2.2],
  boat: [11, 3.8, 1.6],
};

/**
 * Chase camera. Springs towards a point behind the vehicle, widens its field
 * of view with speed, shakes on impact, never dips under the terrain, and can
 * be orbited by dragging (it drifts back behind the vehicle on release).
 */
export function CameraRig() {
  const { camera, gl } = useThree();
  const look = useMemo(() => new THREE.Vector3(), []);
  const desired = useMemo(() => new THREE.Vector3(), []);
  const dir = useMemo(() => new THREE.Vector3(), []);
  const orbit = useRef({ yaw: 0, pitch: 0, zoom: 1, dragging: false, lastX: 0, lastY: 0, released: 0 });

  useEffect(() => {
    const el = gl.domElement;
    const o = orbit.current;
    const down = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return; // touch is for the controls
      o.dragging = true;
      o.lastX = e.clientX;
      o.lastY = e.clientY;
      el.setPointerCapture(e.pointerId);
    };
    const move = (e: PointerEvent) => {
      if (!o.dragging) return;
      o.yaw -= (e.clientX - o.lastX) * 0.006;
      o.pitch = THREE.MathUtils.clamp(o.pitch + (e.clientY - o.lastY) * 0.004, -0.5, 1.1);
      o.lastX = e.clientX;
      o.lastY = e.clientY;
    };
    const up = (e: PointerEvent) => {
      if (!o.dragging) return;
      o.dragging = false;
      o.released = performance.now();
      if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
    };
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      o.zoom = THREE.MathUtils.clamp(o.zoom * Math.exp(e.deltaY * 0.0012), 0.55, 2.8);
    };
    el.addEventListener('pointerdown', down);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    el.addEventListener('wheel', wheel, { passive: false });
    return () => {
      el.removeEventListener('pointerdown', down);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      el.removeEventListener('wheel', wheel);
    };
  }, [gl]);

  useFrame((state, rawDt) => {
    const dt = Math.min(rawDt, 1 / 20);
    const cam = camera as THREE.PerspectiveCamera;
    const { vehicle, camera: mode } = store.get();
    const o = orbit.current;
    const [baseDist, baseHeight, lookUp] = RIG[vehicle];
    const far = mode === 'far' ? 2.3 : 1;
    const dist = baseDist * far * o.zoom;
    const height = baseHeight * far * o.zoom * (1 + o.pitch);

    // Orbit eases home a moment after the mouse lets go.
    if (!o.dragging && performance.now() - o.released > 1400) {
      o.yaw *= Math.exp(-2.2 * dt);
      o.pitch *= Math.exp(-2.2 * dt);
    }

    const p = runtime.position;
    dir.copy(runtime.heading);
    if (vehicle !== 'plane') dir.y = 0;
    if (dir.lengthSq() < 1e-4) dir.set(0, 0, 1);
    dir.normalize().applyAxisAngle(THREE.Object3D.DEFAULT_UP, o.yaw);

    desired.copy(p).addScaledVector(dir, -dist);
    desired.y += height;
    if (vehicle === 'plane') desired.y += Math.max(0, -runtime.heading.y) * 3;

    const floor = Math.max(groundAt(desired.x, desired.z), WATER_LEVEL) + 1.1;
    if (desired.y < floor) desired.y = floor;

    if (runtime.snapCamera) {
      cam.position.copy(desired);
      look.copy(p);
      runtime.snapCamera = false;
    } else {
      const stiff = vehicle === 'plane' ? 7 : vehicle === 'heli' ? 4 : 6;
      cam.position.lerp(desired, 1 - Math.exp(-stiff * dt));
      if (cam.position.y < floor) cam.position.y = floor;
    }

    const lookTarget = desired.copy(p).addScaledVector(dir, 2.5);
    lookTarget.y += lookUp;
    look.lerp(lookTarget, 1 - Math.exp(-12 * dt));

    // Impact shake.
    if (runtime.shake > 0.001) {
      const s = runtime.shake * 0.35;
      cam.position.x += (Math.random() - 0.5) * s;
      cam.position.y += (Math.random() - 0.5) * s;
      runtime.shake *= Math.exp(-5 * dt);
    }

    const speed = Math.hypot(runtime.velocity.x, runtime.velocity.y, runtime.velocity.z);
    const fov = 55 + Math.min(1, speed / 60) * 14;
    if (Math.abs(cam.fov - fov) > 0.05) {
      cam.fov += (fov - cam.fov) * (1 - Math.exp(-3 * dt));
      cam.updateProjectionMatrix();
    }
    cam.lookAt(look);
    void state;
  });

  return null;
}
