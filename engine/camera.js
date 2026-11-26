import { clamp, lerp, normAngle } from '../core/math.js';

// Состояние камеры (4.4): eye/bob/shake/drink-tilt. THREE не импортируем — applyTo принимает любую камеру.
export function createCamera(opts = {}) {
  const eye = opts.eye ?? 1.6, crouchEye = opts.crouchEye ?? 1.0;
  let yaw = 0, pitch = 0, x = 0, z = 0, h = eye;
  let bobT = 0, bobAmp = 0, shake = 0, drink = 0;
  return {
    get yaw() { return yaw; },
    get pitch() { return pitch; },
    pos: () => ({ x, z }),
    setPos(nx, nz) { x = nx; z = nz; },
    addLook(dx, dy, sens = 0.0022) {
      yaw = normAngle(yaw - dx * sens);
      pitch = clamp(pitch - dy * sens, -1.35, 1.35);
    },
    addShake(v) { shake = clamp(shake + v, 0, 1); },
    setDrink(p) { drink = clamp(p, 0, 1); },
    update(dt, input, moving) {
      bobT += dt * (moving ? (input.sprint ? 9 : 5.5) : 0);
      bobAmp = lerp(bobAmp, moving ? (input.crouch ? 0.015 : 0.035) : 0, clamp(dt * 8, 0, 1));
      shake = Math.max(0, shake - dt * 1.8);
      h = lerp(h, input.crouch ? crouchEye : eye, clamp(dt * 10, 0, 1));
    },
    applyTo(cam) {
      const bob = Math.sin(bobT * 2) * bobAmp;
      const sx = Math.sin(bobT * 13.7) * shake * 0.05;
      const roll = Math.sin(bobT * 11.3) * shake * 0.02;
      cam.position.set(x + sx, h + bob, z);
      cam.rotation.set(pitch + drink * 0.3, yaw, roll, 'YXZ');
    },
    state: () => ({ yaw, pitch, x, z, h, bobAmp, shake, drink })
  };
}
