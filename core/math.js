export const TAU = Math.PI * 2;
export const clamp = (v, lo, hi) => v < lo ? lo : v > hi ? hi : v;
export const lerp = (a, b, t) => a + (b - a) * t;
export const moveToward = (a, b, maxStep) => Math.abs(b - a) <= maxStep ? b : a + Math.sign(b - a) * maxStep;
export const normAngle = a => { a = (a + Math.PI) % TAU; if (a < 0) a += TAU; return a - Math.PI; };
export const turnToward = (a, b, maxStep) => normAngle(a + clamp(normAngle(b - a), -maxStep, maxStep));
export const dist2 = (ax, az, bx, bz) => Math.hypot(bx - ax, bz - az);
// Панорама для звука: yaw камеры three (0 = взгляд в -Z), правый вектор = (cos yaw, -sin yaw). [-1..1].
export const panTo = (lx, lz, yaw, sx, sz) => {
  const dx = sx - lx, dz = sz - lz, d = Math.hypot(dx, dz) || 1;
  return clamp((dx * Math.cos(yaw) - dz * Math.sin(yaw)) / d, -1, 1);
};
