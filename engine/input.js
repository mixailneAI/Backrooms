import { clamp } from '../core/math.js';

// Унификация источников ввода. Спринт ТОЛЬКО Shift/кнопка (5.7, грабли 16). Действия — edge-trigger (9.24).
const ACTIONS = { KeyE: 'interact', KeyQ: 'useItem', KeyR: 'arrow', KeyF: 'light' };

export function createInput() {
  const keys = new Set();
  const buttons = new Set();
  const pressed = new Set();
  const joy = { x: 0, y: 0 };
  const move = { x: 0, z: 0 };
  const look = { x: 0, y: 0 };
  let sprint = false, crouch = false, arrowDrawing = false;

  function recompute() {
    let x = joy.x, z = joy.y;
    if (keys.has('KeyW') || keys.has('ArrowUp')) z -= 1;
    if (keys.has('KeyS') || keys.has('ArrowDown')) z += 1;
    if (keys.has('KeyA') || keys.has('ArrowLeft')) x -= 1;
    if (keys.has('KeyD') || keys.has('ArrowRight')) x += 1;
    const len = Math.hypot(x, z);
    if (len > 1) { x /= len; z /= len; }
    move.x = x; move.z = z;
    sprint = keys.has('ShiftLeft') || keys.has('ShiftRight') || buttons.has('sprint');
    crouch = keys.has('KeyC') || keys.has('ControlLeft') || buttons.has('crouch');
  }

  return {
    move,
    look,
    get sprint() { return sprint; },
    get crouch() { return crouch; },
    get isArrowDrawing() { return arrowDrawing || keys.has('KeyF'); },
    setArrowDrawing(value) { arrowDrawing = !!value; },
    setKey(code, down, repeat = false) {
      if (down) { keys.add(code); if (!repeat && ACTIONS[code]) pressed.add(ACTIONS[code]); }
      else keys.delete(code);
      recompute();
    },
    setJoystick(x, y) { joy.x = clamp(x, -1, 1); joy.y = clamp(y, -1, 1); recompute(); },
    setButton(name, down) {
      if (down) { buttons.add(name); if (name !== 'sprint' && name !== 'crouch') pressed.add(name); }
      else buttons.delete(name);
      recompute();
    },
    addLook(dx, dy) { look.x += dx; look.y += dy; },
    consumeLook() { const l = { x: look.x, y: look.y }; look.x = 0; look.y = 0; return l; },
    consumeActions() { const a = [...pressed]; pressed.clear(); return a; },
    reset() { keys.clear(); buttons.clear(); pressed.clear(); arrowDrawing = false; joy.x = 0; joy.y = 0; look.x = 0; look.y = 0; recompute(); }
  };
}
