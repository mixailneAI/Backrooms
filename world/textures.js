import { prng } from '../core/prng.js';

// Процедурные текстуры (4.5). Кэш по ключу тип+палитра (грабли 9.23). Линейная фильтрация (9.5).
const cache = new Map();
export function makeTexture(THREE, type, palette = {}) {
  const key = type + '|' + JSON.stringify(palette);
  if (cache.has(key)) return cache.get(key);
  const size = 256;
  const cv = document.createElement('canvas');
  cv.width = size; cv.height = size;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = palette.base || '#b8a24a';
  ctx.fillRect(0, 0, size, size);
  const r = prng(key);
  if (type === 'carpet') {
    for (let i = 0; i < 2600; i++) { ctx.fillStyle = r.chance(0.5) ? (palette.dark || '#8a7a3a') : (palette.light || '#c9bd7a'); ctx.fillRect(r.int(size), r.int(size), 2, 2); }
  } else if (type === 'panels') {
    ctx.fillStyle = palette.dark || '#9a8a4a';
    for (let y = 0; y < size; y += 32) ctx.fillRect(0, y, size, 2);
    for (let i = 0; i < 300; i++) { ctx.fillStyle = palette.light || '#c9bd7a'; ctx.fillRect(r.int(size), r.int(size), 1, 1); }
  } else if (type === 'concrete') {
    for (let i = 0; i < 1800; i++) { ctx.fillStyle = r.chance(0.5) ? (palette.dark || '#777777') : (palette.light || '#999999'); ctx.fillRect(r.int(size), r.int(size), 3, 3); }
  } else if (type === 'tile') {
    ctx.fillStyle = palette.dark || '#7fa8b8';
    for (let p = 0; p < size; p += 32) { ctx.fillRect(p, 0, 2, size); ctx.fillRect(0, p, size, 2); }
  } else if (type === 'metal') {
    for (let y = 0; y < size; y += 2) { ctx.fillStyle = r.chance(0.5) ? (palette.dark || '#6a6f74') : (palette.light || '#8b9095'); ctx.fillRect(0, y, size, 1); }
  } else if (type === 'water') {
    ctx.fillStyle = palette.light || '#3f7f8f';
    for (let i = 0; i < 40; i++) ctx.fillRect(0, r.int(size), size, 1);
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.colorSpace = THREE.SRGBColorSpace;
  cache.set(key, tex);
  return tex;
}
export function textureCacheSize() { return cache.size; }
