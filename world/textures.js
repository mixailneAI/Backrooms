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
  cv.width = size; cv.height = size;
  const ctx = cv.getContext('2d');
  const base = palette.base || (type === 'ceiling' ? '#b7a98a' : type === 'carpet' ? '#8a7a3a' : '#c7b65a');
  const dark = palette.dark || (type === 'ceiling' ? '#665d49' : type === 'carpet' ? '#5f5428' : '#8e7a32');
  const light = palette.light || (type === 'ceiling' ? '#d6cdb4' : type === 'carpet' ? '#b3a46a' : '#ded08a');
  const r = prng(key);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);
  if (type === 'wall') {
    grad(ctx, size, light, dark);
    const band = 128;
    for (let x = 0; x < size; x += band) {
      ctx.fillStyle = dark;
      ctx.globalAlpha = 0.18;
      ctx.fillRect(x, 0, 4, size);
      ctx.fillStyle = light;
      ctx.globalAlpha = 0.12;
      ctx.fillRect(x + band - 4, 0, 4, size);
      ctx.fillStyle = dark;
      ctx.globalAlpha = 0.20;
      for (let y = 24; y < size; y += 96) {
        ctx.beginPath();
        ctx.moveTo(x + 24, y + 34);
        ctx.lineTo(x + band / 2, y + 4);
        ctx.lineTo(x + band - 24, y + 34);
        ctx.lineTo(x + band / 2, y + 20);
        ctx.closePath();
        ctx.fill();
      }
    }
    for (let i = 0; i < 1800; i++) {
      ctx.fillStyle = r.chance(0.5) ? dark : light;
      ctx.globalAlpha = 0.04 + r.int(16) / 100;
      ctx.fillRect(r.int(size), r.int(size), 8 + r.int(42), 8 + r.int(42));
    }
    ctx.globalAlpha = 1;
  }
  if (type === 'carpet') {
    grad(ctx, size, light, dark);
    for (let i = 0; i < 4200; i++) {
      ctx.fillStyle = r.chance(0.5) ? dark : light;
      ctx.globalAlpha = 0.16 + r.int(34) / 100;
      ctx.fillRect(r.int(size), r.int(size), 4, 4);
    }
    for (let i = 0; i < 90; i++) {
      ctx.fillStyle = dark;
      ctx.globalAlpha = 0.05 + r.int(10) / 100;
      ctx.fillRect(r.int(size), r.int(size), 30 + r.int(90), 20 + r.int(70));
    }
    ctx.globalAlpha = 1;
  }
  if (type === 'ceiling') {
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, size, size);
    const cell = size / 4;
    for (let ty = 0; ty < 4; ty++) {
      for (let tx = 0; tx < 4; tx++) {
        const x0 = tx * cell, y0 = ty * cell;
        ctx.fillStyle = light;
        ctx.globalAlpha = 0.10 + r.int(8) / 100;
        ctx.fillRect(x0 + 5, y0 + 5, cell - 10, cell - 10);
        ctx.globalAlpha = 1;
        for (let i = 0; i < 220; i++) {
          ctx.fillStyle = dark;
          ctx.globalAlpha = 0.12 + r.int(38) / 100;
          ctx.fillRect(x0 + r.int(cell), y0 + r.int(cell), 2, 2);
        }
        ctx.globalAlpha = 1;
        ctx.fillStyle = dark;
        ctx.fillRect(x0, y0, cell, 4);
        ctx.fillRect(x0, y0, 4, cell);
      }
    }
    ctx.fillStyle = dark;
    ctx.globalAlpha = 0.35;
    ctx.fillRect(0, size - 4, size, 4);
    ctx.fillRect(size - 4, 0, 4, size);
    ctx.globalAlpha = 1;
  }
  if (type === 'panels') {
    grad(ctx, size, light, base);
    ctx.fillStyle = dark;
    for (let y = 0; y < size; y += 128) ctx.fillRect(0, y, size, 7);
    for (let x = 0; x < size; x += 256) ctx.fillRect(x, 0, 5, size);
    for (let i = 0; i < 900; i++) {
      ctx.fillStyle = light;
      ctx.globalAlpha = 0.16;
      ctx.fillRect(r.int(size), r.int(size), 3, 3);
    }
    ctx.globalAlpha = 1;
  }
  if (type === 'concrete') {
    grad(ctx, size, light, dark);
    for (let i = 0; i < 2200; i++) {
      ctx.fillStyle = r.chance(0.5) ? dark : light;
      ctx.globalAlpha = 0.20 + r.int(32) / 100;
      ctx.fillRect(r.int(size), r.int(size), 8 + r.int(26), 8 + r.int(26));
    }
    ctx.globalAlpha = 1;
  }
  if (type === 'tile') {
    grad(ctx, size, light, base);
    ctx.fillStyle = dark;
    for (let p = 0; p < size; p += 128) {
      ctx.fillRect(p, 0, 7, size);
      ctx.fillRect(0, p, size, 7);
    }
  }
  if (type === 'metal') {
    for (let y = 0; y < size; y += 4) {
      ctx.fillStyle = r.chance(0.5) ? dark : light;
      ctx.globalAlpha = 0.45 + r.int(35) / 100;
      ctx.fillRect(0, y, size, 3);
    }
    ctx.globalAlpha = 1;
  }
  if (type === 'water') {
    grad(ctx, size, light, dark);
    ctx.globalAlpha = 0.32;
    for (let i = 0; i < 150; i++) {
      ctx.fillStyle = light;
      ctx.fillRect(0, r.int(size), size, 2 + r.int(4));
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
export function textureCacheSize() { return cache.size; }
