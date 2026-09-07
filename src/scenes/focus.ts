import * as THREE from 'three';
import { CAMERA_KEYS } from './layout';

/**
 * The world point the camera is currently looking at.
 *
 * The depth-of-field effect auto-focuses on this every frame. With a fixed
 * focus distance instead, anything nearer or further than that one plane —
 * which is most of the journey — renders soft.
 */
export const focusPoint = new THREE.Vector3(...CAMERA_KEYS.hero.target);
