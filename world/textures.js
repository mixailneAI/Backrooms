import { prng } from '../core/prng.js';

const cache = new Map();
const detailCache = new Map();
const cloneCache = new Map();
const COLOR_SIZE = 2048;
const DETAIL_SIZE = 1024;

function colorFor(type, palette = {}) {
  return {
    base: palette.base || (type === 'ceiling' ? '#b7a98a' : type === 'carpet' ? '#8a7a3a' : '#c7b65a'),
    dark: palette.dark || (type === 'ceiling' ? '#665d49' : type === 'carpet' ? '#5f5428' : '#8e7a32'),
    light: palette.light || (type === 'ceiling' ? '#d6cdb4' : type === 'carpet' ? '#b3a46a' : '#ded08a')
  };
}

function textureCanvas(size, paint) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  paint(ctx, size);
  return canvas;
}

function wrappedRect(ctx, size, x, y, w, h) {
  ctx.fillRect(x, y, w, h);
  if (x + w > size) ctx.fillRect(x - size, y, w, h);
  if (y + h > size) ctx.fillRect(x, y - size, w, h);
  if (x < 0) ctx.fillRect(x + size, y, w, h);
  if (y < 0) ctx.fillRect(x, y + size, w, h);
  if (x + w > size && y + h > size) ctx.fillRect(x - size, y - size, w, h);
}

function paintColor(ctx, size, type, palette, random) {
  const { base, dark, light } = palette;
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);

  if (type === 'wall') {
    // The panel rhythm divides evenly into the image width, so opposite edges match.
    for (let x = 0; x < size; x += 128) {
      ctx.globalAlpha = 0.045;
      ctx.fillStyle = light;
      ctx.fillRect(x, 0, 34, size);
      ctx.globalAlpha = 0.055;
      ctx.fillStyle = dark;
      ctx.fillRect((x + 76) % size, 0, 4, size);
    }
    ctx.globalAlpha = 0.10;
    ctx.fillStyle = dark;
    ctx.fillRect(0, 0, size, 3);
    ctx.fillRect(0, size - 3, size, 3);
    ctx.fillRect(0, size / 2, size, 3);
    ctx.fillRect(0, 0, 3, size);
    ctx.fillRect(size - 3, 0, 3, size);
    for (let i = 0; i < 520; i++) {
      const x = random.int(size), y = random.int(size);
      const w = 12 + random.int(76), h = 8 + random.int(58);
      ctx.globalAlpha = 0.025 + random.int(8) / 100;
      ctx.fillStyle = random.chance(0.58) ? dark : light;
      wrappedRect(ctx, size, x, y, w, h);
    }
  } else if (type === 'carpet') {
    // Fine, isotropic fibre noise avoids directional bands in the walking surface.
    for (let i = 0; i < 26000; i++) {
      const x = random.int(size), y = random.int(size);
      ctx.globalAlpha = 0.025 + random.int(9) / 100;
      ctx.fillStyle = random.chance(0.52) ? dark : light;
      wrappedRect(ctx, size, x, y, 2, 2);
    }
    for (let i = 0; i < 46; i++) {
      const x = random.int(size), y = random.int(size);
      ctx.globalAlpha = 0.035 + random.int(5) / 100;
      ctx.fillStyle = random.chance(0.5) ? dark : light;
      wrappedRect(ctx, size, x, y, 28 + random.int(120), 18 + random.int(90));
    }
  } else if (type === 'ceiling') {
    const cell = size / 4;
    for (let ty = 0; ty < 4; ty++) {
      for (let tx = 0; tx < 4; tx++) {
        const x = tx * cell, y = ty * cell;
        ctx.globalAlpha = 0.08;
        ctx.fillStyle = light;
        ctx.fillRect(x + 7, y + 7, cell - 14, cell - 14);
        ctx.globalAlpha = 0.08;
        ctx.fillStyle = dark;
        ctx.fillRect(x, y, cell, 4);
        ctx.fillRect(x, y, 4, cell);
      }
    }
    ctx.globalAlpha = 1;
  } else if (type === 'panels') {
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = dark;
    for (let y = 0; y < size; y += 128) ctx.fillRect(0, y, size, 7);
    for (let x = 0; x < size; x += 256) ctx.fillRect(x, 0, 5, size);
  } else if (type === 'concrete') {
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, size, size);
    for (let i = 0; i < 4400; i++) {
      const x = random.int(size), y = random.int(size);
      ctx.globalAlpha = 0.08 + random.int(18) / 100;
      ctx.fillStyle = random.chance(0.5) ? dark : light;
      wrappedRect(ctx, size, x, y, 4 + random.int(22), 4 + random.int(22));
    }
  } else if (type === 'tile') {
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = dark;
    for (let p = 0; p < size; p += 256) {
      ctx.fillRect(p, 0, 6, size);
      ctx.fillRect(0, p, size, 6);
    }
  } else if (type === 'metal') {
    for (let y = 0; y < size; y += 8) {
      ctx.globalAlpha = 0.22 + random.int(20) / 100;
      ctx.fillStyle = random.chance(0.5) ? dark : light;
      ctx.fillRect(0, y, size, 2);
    }
  } else if (type === 'water') {
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, size, size);
    ctx.globalAlpha = 0.12;
    ctx.strokeStyle = light;
    for (let i = 0; i < 56; i++) {
      const y = i * (size / 56);
      ctx.beginPath();
      ctx.moveTo(0, y);
      for (let x = 1; x <= 32; x++) {
        const px = (x / 32) * size;
        const py = y + Math.sin((x / 32) * Math.PI * 2) * 7;
        ctx.lineTo(px, py);
      }
      ctx.stroke();
    }
  }
  ctx.globalAlpha = 1;
}

function makeCanvasTexture(THREE, canvas, color = false) {
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  if (color) texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  texture.generateMipmaps = true;
  return texture;
}

export function makeTexture(THREE, type, palette = {}) {
  const key = type + '|' + JSON.stringify(palette);
  if (cache.has(key)) return cache.get(key);
  const colors = colorFor(type, palette);
  const random = prng(key);
  const canvas = textureCanvas(COLOR_SIZE, (ctx, size) => paintColor(ctx, size, type, colors, random));
  const texture = makeCanvasTexture(THREE, canvas, true);
  cache.set(key, texture);
  return texture;
}

export function makeDetailMaps(THREE, type, palette = {}) {
  const key = type + '|' + JSON.stringify(palette);
  if (detailCache.has(key)) return detailCache.get(key);
  const random = prng('detail|' + key);
  const bumpCanvas = textureCanvas(DETAIL_SIZE, (ctx, size) => {
    ctx.fillStyle = '#808080';
    ctx.fillRect(0, 0, size, size);
    const count = type === 'carpet' ? 12000 : type === 'wall' ? 1700 : 700;
    for (let i = 0; i < count; i++) {
      ctx.globalAlpha = 0.025 + random.int(20) / 100;
      const v = 90 + random.int(90);
      ctx.fillStyle = `rgb(${v},${v},${v})`;
      wrappedRect(ctx, size, random.int(size), random.int(size), type === 'carpet' ? 2 : 4 + random.int(12), type === 'carpet' ? 2 : 4 + random.int(12));
    }
    if (type === 'wall' || type === 'panels' || type === 'tile') {
      ctx.globalAlpha = 0.22;
      ctx.fillStyle = '#555';
      const spacing = type === 'tile' ? 256 : 128;
      for (let p = 0; p < size; p += spacing) {
        ctx.fillRect(p, 0, 2, size);
        ctx.fillRect(0, p, size, 2);
      }
    }
    ctx.globalAlpha = 1;
  });
  const normalCanvas = textureCanvas(DETAIL_SIZE, (ctx, size) => {
    ctx.fillStyle = 'rgb(128,128,255)';
    ctx.fillRect(0, 0, size, size);
    ctx.globalAlpha = 0.20;
    ctx.strokeStyle = 'rgb(145,112,252)';
    ctx.lineWidth = type === 'carpet' ? 1 : 2;
    for (let i = 0; i < (type === 'carpet' ? 1800 : 420); i++) {
      const x = random.int(size), y = random.int(size);
      const len = type === 'carpet' ? 5 + random.int(12) : 8 + random.int(24);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo((x + len) % size, (y + random.int(5) - 2 + size) % size);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  });
  const maps = {
    bumpMap: makeCanvasTexture(THREE, bumpCanvas),
    normalMap: makeCanvasTexture(THREE, normalCanvas)
  };
  detailCache.set(key, maps);
  return maps;
}

export function makeTexturedClone(THREE, type, palette = {}, rx = 1, ry = 1) {
  const base = makeTexture(THREE, type, palette);
  const ck = type + '|' + JSON.stringify(palette) + '|' + rx + ',' + ry;
  if (cloneCache.has(ck)) return cloneCache.get(ck);
  const texture = base.clone();
  texture.needsUpdate = true;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  texture.repeat.set(rx, ry);
  cloneCache.set(ck, texture);
  return texture;
}

export function textureCacheSize() { return cache.size; }
export function detailTextureCacheSize() { return detailCache.size; }
