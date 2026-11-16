import { useSyncExternalStore } from 'react';
import * as THREE from 'three';

export type VehicleKind = 'car' | 'bike' | 'plane' | 'heli' | 'boat';

export const VEHICLES: { id: VehicleKind; label: string; key: string; blurb: string }[] = [
  { id: 'car', label: 'Car', key: '1', blurb: 'Rear-wheel drive coupé. Handbrake to drift.' },
  { id: 'bike', label: 'Bike', key: '2', blurb: 'Sport bike. Leans into corners, wheelies on boost.' },
  { id: 'plane', label: 'Plane', key: '3', blurb: 'Prop plane. Take off from the runway.' },
  { id: 'heli', label: 'Heli', key: '4', blurb: 'Helicopter. Hovers anywhere, lands anywhere.' },
  { id: 'boat', label: 'Boat', key: '5', blurb: 'Speedboat. Launches from the marina.' },
];

/* --------------------------------------------------------------- per-frame */

/** Unified control axes. Keyboard, touch and gamepad all write into this. */
export interface Controls {
  /** -1..1 — forward/back (W/S, ↑/↓). Pitch for the plane in the air. */
  y: number;
  /** -1..1 — right/left (D/A, →/←). */
  x: number;
  /** -1..1 — climb/descend (Space / Shift-C) for the helicopter. */
  lift: number;
  boost: boolean;
  brake: boolean;
}

/**
 * Mutable, non-React runtime. Physics writes, renderers read, every frame.
 * Pushing this through React state would re-render the tree 60× a second.
 */
export const runtime = {
  controls: { y: 0, x: 0, lift: 0, boost: false, brake: false } as Controls,
  /** Active vehicle pose (world). */
  position: new THREE.Vector3(),
  quaternion: new THREE.Quaternion(),
  velocity: new THREE.Vector3(),
  /** Direction the chase camera should sit behind. */
  heading: new THREE.Vector3(0, 0, -1),
  speed: 0,
  altitude: 0,
  throttle: 0,
  rpm: 0,
  grounded: true,
  /** Seconds since the vehicle last touched anything. */
  airTime: 0,
  /** Camera shake impulse, decays in the camera rig. */
  shake: 0,
  /** Input is frozen while a panel is open. */
  frozen: false,
  /** 0 = day, 1 = night; eased towards store.night. */
  nightMix: 0,
  /** Set on teleports so the camera jumps instead of flying across the map. */
  snapCamera: true,
  /** One-shot spawn override (fast travel / tests), consumed on the next respawn. */
  teleport: null as null | { x: number; z: number; yaw: number; y?: number },
  elapsed: 0,
};

/* ------------------------------------------------------------- React store */

export interface Toast {
  id: number;
  title: string;
  body?: string;
  tone?: 'skill' | 'info' | 'warn';
}

export type PanelId = 'about' | 'skills' | 'contact' | 'help' | 'places' | null;

interface StoreState {
  vehicle: VehicleKind;
  /** Generation counter: bumps on every respawn so vehicles reset. */
  spawnId: number;
  /** 'here' keeps the current spot when it makes sense; 'home' uses the vehicle's base. */
  spawnMode: 'here' | 'home';
  /** Zone the vehicle is currently inside. */
  zone: string | null;
  panel: PanelId;
  night: boolean;
  muted: boolean;
  collected: string[];
  toasts: Toast[];
  camera: 'chase' | 'far';
  /** Car paint swatch index. */
  paint: number;
  /** Visitor has dismissed the intro. */
  started: boolean;
}

const STORAGE_KEY = 'karan-island-skills';

function loadCollected(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((v) => typeof v === 'string') : [];
  } catch {
    return [];
  }
}

let state: StoreState = {
  vehicle: 'car',
  spawnId: 0,
  spawnMode: 'home',
  zone: null,
  panel: null,
  night: false,
  muted: true,
  collected: typeof window === 'undefined' ? [] : loadCollected(),
  toasts: [],
  camera: 'chase',
  paint: 0,
  started: false,
};

const listeners = new Set<() => void>();
let toastId = 0;

export const store = {
  get: () => state,
  set(patch: Partial<StoreState>) {
    state = { ...state, ...patch };
    listeners.forEach((l) => l());
  },
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  toast(toast: Omit<Toast, 'id'>, ms = 3200) {
    const id = ++toastId;
    store.set({ toasts: [...state.toasts.slice(-2), { ...toast, id }] });
    window.setTimeout(() => store.set({ toasts: state.toasts.filter((t) => t.id !== id) }), ms);
  },
  collect(name: string) {
    if (state.collected.includes(name)) return false;
    const collected = [...state.collected, name];
    store.set({ collected });
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(collected));
    } catch {
      /* private mode — progress just won't persist */
    }
    return true;
  },
  setVehicle(vehicle: VehicleKind) {
    if (vehicle === state.vehicle) return;
    store.set({ vehicle, spawnId: state.spawnId + 1, spawnMode: 'here' });
  },
  /** Fast travel: land vehicles only (a boat on a hilltop helps nobody). */
  travel(x: number, z: number, yaw: number) {
    runtime.teleport = { x, z, yaw };
    const v = state.vehicle;
    store.set({ vehicle: v === 'boat' || v === 'plane' ? 'car' : v, spawnId: state.spawnId + 1, spawnMode: 'here', panel: null });
  },
  /** Jump to a vehicle's home base (runway, marina…). */
  base(vehicle: VehicleKind) {
    store.set({ vehicle, spawnId: state.spawnId + 1, spawnMode: 'home', panel: null });
  },
  teleport(x: number, z: number, yaw = 0, y?: number) {
    runtime.teleport = { x, z, yaw, y };
    store.respawn('here');
  },
  respawn(mode: 'here' | 'home' = 'here') {
    store.set({ spawnId: state.spawnId + 1, spawnMode: mode });
  },
};

export function useStore<T>(select: (s: StoreState) => T): T {
  return useSyncExternalStore(store.subscribe, () => select(state), () => select(state));
}
