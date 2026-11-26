import { prng } from '../core/prng.js';
const cache = new Map();
const cloneCache = new Map();

function grad(ctx, size, top, bottom) {
  const g = ctx.createLinearGradient(0, 0, 0, size);
  g.addColorStop(0, top);
  g.addColorStop(1, bottom);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
}

export function makeTexture(THREE, type, palette = {}) {
  const key = type + '|' + JSON.stringify(palette);
  if (cache.has(key)) return cache.get(key);

  const size = 1024;
  const cv = document.createElement('canvas');
  cv.width = size;
  cv.height = size;
  const ctx = cv.getContext('2d');

  const base = palette.base || '#b8a24a';
  const dark = palette.dark || '#8a7a3a';
  const light = palette.light || '#c9bd7a';
  const r = prng(key);

  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);

  if (type === 'carpet') {
    grad(ctx, size, light, dark);
    for (let i = 0; i < 9000; i++) {
      ctx.fillStyle = r.chance(0.5) ? dark : light;
      ctx.globalAlpha = 0.35 + r.next() * 0.35;
      ctx.fillRect(r.int(size), r.int(size), 3, 3);
    }
    ctx.globalAlpha = 1;
  } else if (type === 'panels') {
    grad(ctx, size, light, base);
    ctx.fillStyle = dark;
    for (let y = 0; y < size; y += 128) ctx.fillRect(0, y, size, 6);
    for (let x = 0; x < size; x += 256) ctx.fillRect(x, 0, 4, size);
    for (let i = 0; i < 1200; i++) {
      ctx.fillStyle = light;
      ctx.globalAlpha = 0.25;
      ctx.fillRect(r.int(size), r.int(size), 2, 2);
    }
    ctx.globalAlpha = 1;
  } else if (type === 'concrete') {
    grad(ctx, size, light, dark);
    for (let i = 0; i < 5000; i++) {
      ctx.fillStyle = r.chance(0.5) ? dark : light;
      ctx.globalAlpha = 0.45;
      ctx.fillRect(r.int(size), r.int(size), 6, 6);
    }
    ctx.globalAlpha = 1;
  } else if (type === 'tile') {
    grad(ctx, size, light, base);
    ctx.fillStyle = dark;
    for (let p = 0; p < size; p += 128) {
      ctx.fillRect(p, 0, 6, size);
      ctx.fillRect(0, p, size, 6);
    }
  } else if (type === 'metal') {
    for (let y = 0; y < size; y += 3) {
      ctx.fillStyle = r.chance(0.5) ? dark : light;
      ctx.fillRect(0, y, size, 2);
    }
  } else if (type === 'water') {
    grad(ctx, size, light, dark);
    ctx.globalAlpha = 0.45;
    for (let i = 0; i < 120; i++) {
      ctx.fillStyle = light;
      ctx.fillRect(0, r.int(size), size, 2);
    }
    ctx.globalAlpha = 1;
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  cache.set(key, tex);
  return tex;
}

export function makeTexturedClone(THREE, type, palette = {}, rx = 1, ry = 1) {
  const base = makeTexture(THREE, type, palette);
  const ck = type + '|' + JSON.stringify(palette) + '|' + rx + ',' + ry;
  if (cloneCache.has(ck)) return cloneCache.get(ck);

  const t = base.clone();
  t.needsUpdate = true;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.magFilter = THREE.LinearFilter;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  t.repeat.set(rx, ry);

  cloneCache.set(ck, t);
  return t;
}

export function textureCacheSize() {
  return cache.size;
}
