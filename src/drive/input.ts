import { runtime, store, VEHICLES } from './state';

/** Held keys, by `KeyboardEvent.code`. */
const held = new Set<string>();

/** Touch controls write here (see TouchControls.tsx). */
export const touch = { x: 0, y: 0, lift: 0, boost: false, brake: false, active: false };

type Action = 'interact' | 'horn';
const actionListeners = new Set<(action: Action) => void>();
export function onAction(listener: (action: Action) => void) {
  actionListeners.add(listener);
  return () => {
    actionListeners.delete(listener);
  };
}
export function fireAction(action: Action) {
  actionListeners.forEach((l) => l(action));
}

const GAME_KEYS = new Set([
  'KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyQ', 'KeyE', 'KeyC',
  'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
  'Space', 'ShiftLeft', 'ShiftRight', 'ControlLeft',
]);

function isTyping(target: EventTarget | null) {
  const el = target as HTMLElement | null;
  return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);
}

export function installKeyboard() {
  const down = (e: KeyboardEvent) => {
    if (isTyping(e.target)) return;
    if (GAME_KEYS.has(e.code)) {
      // Arrows and space would otherwise scroll the page underneath.
      e.preventDefault();
      held.add(e.code);
    }
    if (e.repeat) return;

    const s = store.get();
    const vehicle = VEHICLES.find((v) => v.key === e.key);
    if (vehicle && !s.panel) {
      store.setVehicle(vehicle.id);
      return;
    }
    switch (e.code) {
      case 'KeyR':
        store.respawn('here');
        break;
      case 'KeyN':
        store.set({ night: !s.night });
        break;
      case 'KeyM':
        store.set({ muted: !s.muted });
        break;
      case 'KeyP':
        store.set({ paint: s.paint + 1 });
        break;
      case 'KeyV':
        store.set({ camera: s.camera === 'chase' ? 'far' : 'chase' });
        break;
      case 'KeyH':
        fireAction('horn');
        break;
      case 'KeyE':
      case 'Enter':
        if (!s.panel) fireAction('interact');
        break;
      case 'Slash':
        store.set({ panel: s.panel === 'help' ? null : 'help' });
        break;
    }
  };
  const up = (e: KeyboardEvent) => held.delete(e.code);
  const clear = () => held.clear();

  window.addEventListener('keydown', down);
  window.addEventListener('keyup', up);
  window.addEventListener('blur', clear);
  return () => {
    window.removeEventListener('keydown', down);
    window.removeEventListener('keyup', up);
    window.removeEventListener('blur', clear);
  };
}

const axis = (pos: boolean, neg: boolean) => (pos ? 1 : 0) - (neg ? 1 : 0);
const dead = (v: number, d = 0.15) => (Math.abs(v) < d ? 0 : (v - Math.sign(v) * d) / (1 - d));

/** Merge every input source into runtime.controls. Call once per frame. */
export function updateControls() {
  const c = runtime.controls;
  if (runtime.frozen) {
    c.x = c.y = c.lift = 0;
    c.boost = false;
    c.brake = true;
    return;
  }

  let x = axis(held.has('KeyD') || held.has('ArrowRight'), held.has('KeyA') || held.has('ArrowLeft'));
  let y = axis(held.has('KeyW') || held.has('ArrowUp'), held.has('KeyS') || held.has('ArrowDown'));
  let lift = axis(held.has('Space'), held.has('KeyC') || held.has('ControlLeft') || held.has('KeyQ'));
  let boost = held.has('ShiftLeft') || held.has('ShiftRight');
  let brake = held.has('Space');

  if (touch.active) {
    x += touch.x;
    y += touch.y;
    lift += touch.lift;
    boost ||= touch.boost;
    brake ||= touch.brake;
  }

  const pads = typeof navigator !== 'undefined' && navigator.getGamepads ? navigator.getGamepads() : [];
  for (const pad of pads) {
    if (!pad) continue;
    x += dead(pad.axes[0] ?? 0);
    const trig = (pad.buttons[7]?.value ?? 0) - (pad.buttons[6]?.value ?? 0);
    y += Math.abs(trig) > 0.05 ? trig : -dead(pad.axes[1] ?? 0);
    lift += (pad.buttons[0]?.pressed ? 1 : 0) - (pad.buttons[1]?.pressed ? 1 : 0);
    boost ||= !!pad.buttons[5]?.pressed;
    brake ||= !!pad.buttons[2]?.pressed;
    break;
  }

  c.x = Math.max(-1, Math.min(1, x));
  c.y = Math.max(-1, Math.min(1, y));
  c.lift = Math.max(-1, Math.min(1, lift));
  c.boost = boost;
  c.brake = brake;
}
