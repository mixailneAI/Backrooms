// M2 v2: комнаты + L-коридоры. Никаких сквозных прямых магистралей.
import { prng } from '../core/prng.js';
export const CHUNK = 16;
export const GATES = [4, 11];
const cache = new Map();
export const idx = (x, z) => z * CHUNK + x;
function carveRect(walls, x0, z0, w, h) {
  for (let z = z0; z < z0 + h; z++) for (let x = x0; x < x0 + w; x++) {
    if (x < 1 || z < 1 || x > CHUNK - 2 || z > CHUNK - 2) continue;
    walls[idx(x, z)] = 0;
  }
}
function corridor(walls, ax, az, bx, bz) {
  const x0 = Math.min(ax, bx), x1 = Math.max(ax, bx);
  for (let x = x0; x <= x1; x++) carveRect(walls, x, az - 1, 1, 2);
  const z0 = Math.min(az, bz), z1 = Math.max(az, bz);
  for (let z = z0; z <= z1; z++) carveRect(walls, bx - 1, z, 2, 1);
}
export function chunkLayout(seed, cx, cz) {
  const key = seed + '|' + cx + '|' + cz;
  if (cache.has(key)) return cache.get(key);
  const r = prng('chunk|' + key);
  const walls = new Uint8Array(CHUNK * CHUNK).fill(1);
  const rooms = [];
  const count = 3 + r.int(3);
  for (let i = 0; i < count; i++) {
    const w = 3 + r.int(4), h = 3 + r.int(4);
    const x0 = 1 + r.int(CHUNK - 2 - w), z0 = 1 + r.int(CHUNK - 2 - h);
    carveRect(walls, x0, z0, w, h);
    rooms.push({ x: x0 + (w >> 1), z: z0 + (h >> 1) });
  }
  for (let i = 0; i < rooms.length - 1; i++) corridor(walls, rooms[i].x, rooms[i].z, rooms[i + 1].x, rooms[i + 1].z);
  for (const g of GATES) {
    walls[idx(g, 0)] = 0; walls[idx(g, CHUNK - 1)] = 0; walls[idx(0, g)] = 0; walls[idx(CHUNK - 1, g)] = 0;
    carveRect(walls, g - 1, 1, 2, 2); carveRect(walls, g - 1, CHUNK - 3, 2, 2);
    carveRect(walls, 1, g - 1, 2, 2); carveRect(walls, CHUNK - 3, g - 1, 2, 2);
    corridor(walls, g, 2, rooms[0].x, rooms[0].z);
    corridor(walls, g, CHUNK - 3, rooms[rooms.length - 1].x, rooms[rooms.length - 1].z);
    corridor(walls, 2, g, rooms[0].x, rooms[0].z);
    corridor(walls, CHUNK - 3, g, rooms[rooms.length - 1].x, rooms[rooms.length - 1].z);
  }
  const free = [];
  for (let z = 1; z < CHUNK - 1; z++) for (let x = 1; x < CHUNK - 1; x++) if (!walls[idx(x, z)]) free.push([x, z]);
  const layout = { seed, cx, cz, size: CHUNK, walls, rooms, free, spawn: rooms[0], exit: rooms[rooms.length - 1] };
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
export function chunkBounds(cx, cz) { return { minX: cx * CHUNK, minZ: cz * CHUNK, w: CHUNK, d: CHUNK }; }
export function seamGatesFree(a, b, axis) {
  for (const g of GATES) {
    const ia = axis === 'x' ? idx(CHUNK - 1, g) : idx(g, CHUNK - 1);
    const ib = axis === 'x' ? idx(0, g) : idx(g, 0);
    if (a.walls[ia] || b.walls[ib]) return false;
  }
  return true;
}
