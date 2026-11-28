// M2: чистый детерминированный генератор чанков. Без THREE — годен для doctor/гейтов.
import { prng } from '../core/prng.js';
export const CHUNK = 16;
// Ворота на границах ФИКСИРОВАНЫ (не рандом) => соседние чанки всегда стыкуются проходами.
export const GATES = [4, 11];
const cache = new Map();
export const idx = (x, z) => z * CHUNK + x;
export function chunkLayout(seed, cx, cz) {
  const key = seed + '|' + cx + '|' + cz;
  if (cache.has(key)) return cache.get(key);
  const r = prng('chunk|' + key);
  const walls = new Uint8Array(CHUNK * CHUNK);
  const cross = new Set();
  for (const g of GATES) for (let i = 0; i < CHUNK; i++) { cross.add(idx(g, i)); cross.add(idx(i, g)); }
  for (let z = 0; z < CHUNK; z++) {
    for (let x = 0; x < CHUNK; x++) {
      const border = x === 0 || z === 0 || x === CHUNK - 1 || z === CHUNK - 1;
      if (border) {
        const gate = (GATES.includes(x) && (z === 0 || z === CHUNK - 1)) || (GATES.includes(z) && (x === 0 || x === CHUNK - 1));
        walls[idx(x, z)] = gate ? 0 : 1;
      } else if (cross.has(idx(x, z))) {
        walls[idx(x, z)] = 0;
      } else {
        walls[idx(x, z)] = r.chance(0.24) ? 1 : 0;
      }
    }
  }
  const layout = { seed, cx, cz, size: CHUNK, walls, spawn: { x: GATES[0], z: GATES[0] }, exit: { x: GATES[1], z: GATES[1] } };
  cache.set(key, layout);
  return layout;
}
export function reachable(layout, sx, sz) {
  const seen = new Set([idx(sx, sz)]);
  const queue = [[sx, sz]];
  while (queue.length) {
    const [x, z] = queue.pop();
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, nz = z + dz;
      if (nx < 0 || nz < 0 || nx >= CHUNK || nz >= CHUNK) continue;
      const i = idx(nx, nz);
      if (layout.walls[i] || seen.has(i)) continue;
      seen.add(i); queue.push([nx, nz]);
    }
  }
  return seen;
}
export function chunkBounds(cx, cz) {
  return { minX: cx * CHUNK, minZ: cz * CHUNK, w: CHUNK, d: CHUNK };
}
export function seamGatesFree(a, b, axis) {
  // axis 'x': a.right (x=15) vs b.left (x=0); axis 'z': a.bottom (z=15) vs b.top (z=0)
  for (const g of GATES) {
    const ia = axis === 'x' ? idx(CHUNK - 1, g) : idx(g, CHUNK - 1);
    const ib = axis === 'x' ? idx(0, g) : idx(g, 0);
    if (a.walls[ia] || b.walls[ib]) return false;
  }
  return true;
}
