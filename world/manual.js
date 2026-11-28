import { makeTexturedClone, makeDetailMaps } from './textures.js';

const glowMaps = new WeakMap();

function glowTexture(THREE) {
  if (glowMaps.has(THREE)) return glowMaps.get(THREE);
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createRadialGradient(64, 64, 2, 64, 64, 64);
  gradient.addColorStop(0, 'rgba(255,244,190,0.82)');
  gradient.addColorStop(0.25, 'rgba(255,220,120,0.34)');
  gradient.addColorStop(1, 'rgba(255,198,70,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 128, 128);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  glowMaps.set(THREE, texture);
  return texture;
}

export function createManualWorld(THREE, scene, opts = {}) {
  const height = opts.height ?? 3;
  const bounds = opts.bounds || { w: 16, d: 16 };
  const worldPalette = opts.palette || {};
  const group = new THREE.Group();
  const colliders = [], interactables = [], spawns = [], animated = [];
  const matCache = new Map();
  const tile = 2;
  let lampCount = 0;

  function resolvePalette(type, override = {}) {
    const p = override || {};
    const mapped = worldPalette[type];
    const out = {};
    if (typeof p === 'string') out.base = p;
    else {
      if (p.base) out.base = p.base;
      if (p.dark) out.dark = p.dark;
      if (p.light) out.light = p.light;
    }
    if (typeof mapped === 'string') {
      if (!out.base) out.base = mapped;
    } else if (mapped && typeof mapped === 'object') {
      if (!out.base) out.base = mapped.base;
      if (!out.dark) out.dark = mapped.dark;
      if (!out.light) out.light = mapped.light;
    }
    return out;
  }

  function material(type, palette = {}, rx = 1, ry = 1) {
    const pal = resolvePalette(type, palette);
    const key = type + '|' + JSON.stringify(pal) + '|' + rx + ',' + ry;
    if (!matCache.has(key)) {
      const map = makeTexturedClone(THREE, type, pal, rx, ry);
      const details = makeDetailMaps(THREE, type, pal);
      matCache.set(key, new THREE.MeshStandardMaterial({
        map,
        bumpMap: details.bumpMap,
        bumpScale: type === 'carpet' ? 0.032 : type === 'wall' ? 0.024 : 0.012,
        normalMap: details.normalMap,
        normalScale: new THREE.Vector2(type === 'carpet' ? 0.28 : 0.18, type === 'carpet' ? 0.28 : 0.18),
        roughness: type === 'metal' ? 0.48 : 0.92,
        metalness: type === 'metal' ? 0.32 : 0.015
      }));
    }
    return matCache.get(key);
  }

  function faceMaterials(type, palette, w, h, d) {
    // BoxGeometry groups are +X, -X, +Y, -Y, +Z, -Z.
    return [
      material(type, palette, d / tile, h / tile),
      material(type, palette, d / tile, h / tile),
      material(type, palette, w / tile, d / tile),
      material(type, palette, w / tile, d / tile),
      material(type, palette, w / tile, h / tile),
      material(type, palette, w / tile, h / tile)
    ];
  }

  function box(o = {}) {
    const w = o.w ?? 1, h = o.h ?? height, d = o.d ?? 1;
    const mats = o.mat || faceMaterials(o.type || 'wall', o.palette, w, h, d);
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mats);
    mesh.position.set(o.x || 0, (o.y ?? 0) + h / 2, o.z || 0);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    if (o.solid !== false) colliders.push({ x: o.x || 0, z: o.z || 0, w, d, passable: false });
    return mesh;
  }

  function plane(o, y, rot) {
    const w = o.w ?? 4, d = o.d ?? 4;
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, d), o.mat || material(o.type || 'floor', o.palette, w / tile, d / tile));
    mesh.rotation.x = rot;
    mesh.position.set(o.x || 0, y, o.z || 0);
    mesh.receiveShadow = true;
    group.add(mesh);
    return mesh;
  }

  function bottleMesh(color) {
    const groupBottle = new THREE.Group();
    const glass = new THREE.MeshPhysicalMaterial({
      color: color || '#b9e8d2', transparent: true, opacity: 0.48,
      roughness: 0.1, metalness: 0.02, clearcoat: 0.9, clearcoatRoughness: 0.08,
      depthWrite: false
    });
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.115, 0.132, 0.34, 24, 1, false), glass);
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.067, 0.105, 20), glass);
    neck.position.y = 0.215;
    const shoulder = new THREE.Mesh(new THREE.CylinderGeometry(0.067, 0.115, 0.065, 24), glass);
    shoulder.position.y = 0.17;
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.057, 0.057, 0.065, 16), new THREE.MeshStandardMaterial({ color: '#477d4d', roughness: 0.58, metalness: 0.04 }));
    cap.position.y = 0.295;
    const labelMat = new THREE.MeshStandardMaterial({ color: '#f7f0d7', roughness: 0.72, metalness: 0, transparent: true, opacity: 0.84, side: THREE.DoubleSide });
    const label = new THREE.Mesh(new THREE.CylinderGeometry(0.118, 0.118, 0.105, 24, 1, true), labelMat);
    label.position.y = -0.015;
    const labelBand = new THREE.Mesh(new THREE.CylinderGeometry(0.119, 0.119, 0.012, 24, 1, true), new THREE.MeshStandardMaterial({ color: '#8b9b66', roughness: 0.8, side: THREE.DoubleSide }));
    labelBand.position.y = 0.04;
    groupBottle.add(body, shoulder, neck, cap, label, labelBand);
    groupBottle.traverse(mesh => { if (mesh.isMesh) { mesh.castShadow = true; mesh.receiveShadow = true; } });
    return groupBottle;
  }

  function foodMesh(color) {
    const food = new THREE.Group();
    const meatMat = new THREE.MeshStandardMaterial({ color: color || '#c98a3a', emissive: '#6f3511', emissiveIntensity: 0.18, roughness: 0.74, metalness: 0 });
    const boneMat = new THREE.MeshStandardMaterial({ color: '#e8d9b8', roughness: 0.86, metalness: 0 });
    const piece = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.155, 0.075, 20, 1, false), meatMat);
    piece.scale.set(1.12, 1, 0.88);
    piece.rotation.z = 0.12;
    piece.rotation.y = -0.28;
    const bone = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.035, 0.18, 10), boneMat);
    bone.position.set(0.16, 0.01, 0.035);
    bone.rotation.z = Math.PI / 2.8;
    const endA = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), boneMat);
    const endB = endA.clone();
    endA.position.set(0.235, 0.07, 0.035);
    endB.position.set(0.19, -0.06, 0.035);
    food.add(piece, bone, endA, endB);
    food.traverse(mesh => { if (mesh.isMesh) { mesh.castShadow = true; mesh.receiveShadow = true; } });
    return food;
  }

  function spraycanMesh(color) {
    const spray = new THREE.Group();
    const bodyMat = new THREE.MeshStandardMaterial({ color: color || '#e8d27a', roughness: 0.48, metalness: 0.22, emissive: '#72531c', emissiveIntensity: 0.12 });
    const capMat = new THREE.MeshStandardMaterial({ color: '#554321', roughness: 0.52, metalness: 0.28 });
    const labelMat = new THREE.MeshStandardMaterial({ color: '#f5e9bb', roughness: 0.62, metalness: 0.04 });
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.31, 20), bodyMat);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.065, 0.075, 18), capMat);
    cap.position.y = 0.19;
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.091, 0.091, 0.085, 20, 1, true), labelMat);
    band.position.y = -0.015;
    const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.025, 0.025, 10), labelMat);
    nozzle.position.y = 0.24;
    spray.add(body, cap, band, nozzle);
    spray.traverse(mesh => { if (mesh.isMesh) { mesh.castShadow = true; mesh.receiveShadow = true; } });
    return spray;
  }

  function backpackMesh(color) {
    const pack = new THREE.Group();
    const bodyMat = new THREE.MeshStandardMaterial({ color: color || '#8a6a3a', roughness: 0.94, metalness: 0.02 });
    const trimMat = new THREE.MeshStandardMaterial({ color: '#4d3821', roughness: 0.88, metalness: 0.02 });
    const flapMat = new THREE.MeshStandardMaterial({ color: '#a27b45', roughness: 0.9, metalness: 0.02 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.31, 0.34, 0.17), bodyMat);
    const flap = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.09, 0.19), flapMat);
    flap.position.set(0, 0.13, 0.015);
    const frontPocket = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.13, 0.045), flapMat);
    frontPocket.position.set(0, -0.055, 0.105);
    const strapLeft = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.35, 0.045), trimMat);
    const strapRight = strapLeft.clone();
    strapLeft.position.set(-0.115, 0, -0.105);
    strapRight.position.set(0.115, 0, -0.105);
    const handle = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.018, 6, 14, Math.PI), trimMat);
    handle.rotation.z = Math.PI;
    handle.position.set(0, 0.2, -0.025);
    pack.add(body, flap, frontPocket, strapLeft, strapRight, handle);
    pack.traverse(mesh => { if (mesh.isMesh) { mesh.castShadow = true; mesh.receiveShadow = true; } });
    return pack;
  }

  function paperMesh() {
    const groupPaper = new THREE.Group();
    const paperMat = new THREE.MeshStandardMaterial({ color: '#eee1b9', roughness: 0.88, metalness: 0, side: THREE.DoubleSide });
    const sheet = new THREE.Mesh(new THREE.PlaneGeometry(0.27, 0.36), paperMat);
    sheet.rotation.x = -Math.PI / 2;
    sheet.rotation.z = -0.055;
    sheet.position.y = 0.012;
    sheet.castShadow = true;
    sheet.receiveShadow = true;
    const fold = new THREE.Mesh(new THREE.PlaneGeometry(0.08, 0.36), new THREE.MeshStandardMaterial({ color: '#d8c99e', roughness: 1, transparent: true, opacity: 0.48, side: THREE.DoubleSide }));
    fold.rotation.x = -Math.PI / 2;
    fold.position.set(0.045, 0.014, 0);
    groupPaper.add(sheet, fold);
    return groupPaper;
  }

  function exitFrame(color) {
    const g = new THREE.Group();
    const frameMat = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 1.8, roughness: 0.28, metalness: 0.04 });
    const portalMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.20, side: THREE.DoubleSide, depthWrite: false });
    const glowMat = new THREE.MeshBasicMaterial({ color, map: glowTexture(THREE), transparent: true, opacity: 0.28, blending: THREE.AdditiveBlending, depthWrite: false });
    const left = new THREE.Mesh(new THREE.BoxGeometry(0.09, 2.18, 0.11), frameMat);
    left.position.set(-0.57, 1.09, 0);
    const right = left.clone();
    right.position.x = 0.57;
    const top = new THREE.Mesh(new THREE.BoxGeometry(1.23, 0.09, 0.11), frameMat);
    top.position.set(0, 2.14, 0);
    const bottom = new THREE.Mesh(new THREE.BoxGeometry(1.23, 0.055, 0.11), frameMat);
    bottom.position.set(0, 0.035, 0);
    const portal = new THREE.Mesh(new THREE.PlaneGeometry(1.05, 2.02), portalMat);
    portal.position.set(0, 1.08, -0.015);
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 2.55), glowMat);
    glow.position.set(0, 1.1, -0.035);
    g.add(left, right, top, bottom, portal, glow);
    animated.push({ type: 'portal', portalMat, glowMat, frameMat, phase: 0 });
    return g;
  }

  function marker(o, type, color) {
    const kind = o.data && o.data.kind;
    let mesh, y = type === 'exit' ? 0 : 0.25;
    if (type === 'item' && kind === 'bottle') { mesh = bottleMesh(color); y = 0.22; }
    else if (type === 'item' && kind === 'food') { mesh = foodMesh(color); y = 0.16; }
    else if (type === 'item' && kind === 'spraycan') { mesh = spraycanMesh(color); y = 0.2; }
    else if (type === 'item' && kind === 'backpack') { mesh = backpackMesh(color); y = 0.22; }
    else if (type === 'note' && kind === 'paper') { mesh = paperMesh(); y = 0.045; }
    else if (type === 'exit' && kind === 'frame') { mesh = exitFrame(color); y = 0; }
    else mesh = new THREE.Mesh(new THREE.BoxGeometry(0.4, type === 'exit' ? 2.2 : 0.5, 0.4), new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.22, roughness: 0.62 }));
    mesh.position.set(o.x || 0, y, o.z || 0);
    mesh.traverse?.(child => { if (child.isMesh) { child.castShadow = true; child.receiveShadow = true; } });
    group.add(mesh);
    interactables.push({ id: o.id || type + '_' + interactables.length, type, x: o.x || 0, z: o.z || 0, label: o.label, data: o.data, mesh });
    return mesh;
  }

  const signMaps = new Map();
 function signTexture(THREE, color, text) {
   const k = color + '|' + text;
   if (signMaps.has(k)) return signMaps.get(k);
   const c = document.createElement('canvas'); c.width = 256; c.height = 128;
   const x = c.getContext('2d');
   x.fillStyle = 'rgba(10,8,3,0.88)'; x.fillRect(0, 0, 256, 128);
   x.strokeStyle = color; x.lineWidth = 6; x.strokeRect(6, 6, 244, 116);
   x.fillStyle = color; x.font = 'bold 64px monospace'; x.textAlign = 'center'; x.textBaseline = 'middle';
   x.fillText(text, 128, 68);
   const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
   signMaps.set(k, t); return t;
 }
 function addLampGlow(o, w, d, color) {
    const mat = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 2.4, roughness: 0.32, metalness: 0, side: THREE.DoubleSide });
    const panel = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat);
    panel.rotation.x = -Math.PI / 2;
    panel.position.set(o.x || 0, height - 0.025, o.z || 0);
    group.add(panel);
    const spriteMat = new THREE.SpriteMaterial({ map: glowTexture(THREE), color, transparent: true, opacity: 0.24, blending: THREE.AdditiveBlending, depthWrite: false });
    const sprite = new THREE.Sprite(spriteMat);
    sprite.position.set(o.x || 0, height - 0.16, o.z || 0);
    sprite.scale.set(w * 2.3, d * 3.8, 1);
    group.add(sprite);
    animated.push({ type: 'lamp', mat, spriteMat, phase: lampCount * 1.7 });
    lampCount++;
    return panel;
  }

  return {
    group, colliders, interactables, spawns, box, material,
    cylinder(o = {}) {
      const r = o.r ?? 0.3, h = o.h ?? height;
      const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 20), o.mat || material(o.type || 'concrete', o.palette, (r * 2) / tile, h / tile));
      m.position.set(o.x || 0, h / 2, o.z || 0);
      m.castShadow = true;
      m.receiveShadow = true;
      group.add(m);
      if (o.solid !== false) colliders.push({ x: o.x || 0, z: o.z || 0, w: r * 2, d: r * 2, passable: false });
      return m;
    },
    lightPanel(o = {}) { return addLampGlow(o, o.w ?? 1.2, o.d ?? 0.6, o.color || '#fff2b0'); },
    floor(o = {}) { return plane(o, 0, -Math.PI / 2); },
    ceiling(o = {}) { return plane(o, height, Math.PI / 2); },
    perimeter(o = {}) {
      const w = o.w ?? bounds.w, d = o.d ?? bounds.d, t = o.t ?? 0.3;
      box({ x: 0, z: -d / 2, w, d: t, palette: o.palette });
      box({ x: 0, z: d / 2, w, d: t, palette: o.palette });
      box({ x: -w / 2, z: 0, w: t, d, palette: o.palette });
      box({ x: w / 2, z: 0, w: t, d, palette: o.palette });
    },
    waterPlane(o = {}) {
      const w = o.w ?? 8, d = o.d ?? 8;
      const pal = resolvePalette('water', o.palette);
      const detail = makeDetailMaps(THREE, 'water', pal);
      const mat = new THREE.MeshStandardMaterial({
        map: makeTexturedClone(THREE, 'water', pal, w / tile, d / tile),
        bumpMap: detail.bumpMap, bumpScale: 0.008, normalMap: detail.normalMap,
        normalScale: new THREE.Vector2(0.12, 0.12), transparent: true, opacity: 0.72,
        roughness: 0.22, metalness: 0.05
      });
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat);
      m.rotation.x = -Math.PI / 2;
      m.position.set(o.x || 0, o.y ?? 0.05, o.z || 0);
      m.receiveShadow = true;
      group.add(m);
      return m;
    },
    lightColumn(o = {}) {
      const color = o.color || '#fff2b0';
      const m = new THREE.Mesh(new THREE.CylinderGeometry(o.r ?? 0.5, o.r ?? 0.5, height, 16, 1, true), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.12, side: THREE.DoubleSide, depthWrite: false }));
      m.position.set(o.x || 0, height / 2, o.z || 0);
      group.add(m);
      return m;
    },
    sign(o = {}) { const m = new THREE.Mesh(new THREE.PlaneGeometry(o.w ?? 1.0, o.h ?? 0.5), new THREE.MeshBasicMaterial({ map: signTexture(THREE, o.color || '#ffcf4a', o.text || '→'), transparent: true, depthWrite: false })); m.position.set(o.x || 0, o.y ?? 1.9, o.z || 0); m.rotation.y = o.rot ?? 0; group.add(m); return m; },
     spawn(o = {}) { spawns.push({ x: o.x || 0, z: o.z || 0 }); return spawns[spawns.length - 1]; },
    exit(o = {}) { return marker(o, 'exit', o.color || '#7fff9f'); },
    item(o = {}) { return marker(o, 'item', o.color || '#bfefff'); },
    note(o = {}) { return marker(o, 'note', o.color || '#fff2b0'); },
    door(o = {}) { return marker(o, 'door', o.color || '#c9a24a'); },
    doorWall(o = {}) {
      const m = box({ ...o, type: o.type || 'panels' });
      const idx = colliders.length - 1;
      interactables.push({ id: o.id || 'door_' + interactables.length, type: 'door', x: o.x || 0, z: o.z || 0, label: o.label, data: { ...(o.data || {}), colliderIndex: idx }, mesh: m });
      return m;
    },
    noclipWall(o = {}) {
      const w = o.w ?? 1, h = o.h ?? height, d = o.d ?? 1;
      const pal = resolvePalette('panels', o.palette);
      const detail = makeDetailMaps(THREE, 'panels', pal);
      const mat = new THREE.MeshStandardMaterial({
        map: makeTexturedClone(THREE, 'panels', pal, Math.max(w, d) / tile, h / tile),
        bumpMap: detail.bumpMap, bumpScale: 0.018, normalMap: detail.normalMap,
        transparent: true, opacity: 0.58, roughness: 0.8, metalness: 0.02
      });
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      m.position.set(o.x || 0, (o.y ?? 0) + h / 2, o.z || 0);
      m.castShadow = true;
      group.add(m);
      colliders.push({ x: o.x || 0, z: o.z || 0, w, d, passable: false });
      const idx = colliders.length - 1;
      interactables.push({ id: o.id || 'noclip_' + interactables.length, type: 'noclip', x: o.x || 0, z: o.z || 0, label: o.label, data: { ...(o.data || {}), colliderIndex: idx }, mesh: m });
      return m;
    },
    freeCells() {
      const out = [];
      for (let x = -bounds.w / 2 + 1; x < bounds.w / 2; x++) {
        for (let z = -bounds.d / 2 + 1; z < bounds.d / 2; z++) {
          let free = true;
          for (const c of colliders) {
            if (c.passable || c.x > 1e8) continue;
            if (Math.abs(x - c.x) < c.w / 2 + 0.4 && Math.abs(z - c.z) < c.d / 2 + 0.4) { free = false; break; }
          }
          if (free) out.push({ x, z });
        }
      }
      return out;
    },
    update(time = 0) {
      for (const item of animated) {
        const pulse = 0.86 + Math.sin(time * 2.4 + item.phase) * 0.09 + Math.sin(time * 7.1 + item.phase) * 0.025;
        if (item.type === 'lamp') {
          item.mat.emissiveIntensity = 2.1 * pulse;
          item.spriteMat.opacity = 0.19 + pulse * 0.08;
          if (item.light) item.light.intensity = 0.95 * pulse;
        } else {
          item.portalMat.opacity = 0.13 + pulse * 0.13;
          item.glowMat.opacity = 0.20 + pulse * 0.14;
          item.frameMat.emissiveIntensity = 1.4 + pulse * 0.7;
        }
      }
    },
    flush() { scene.add(group); return group; },
    dispose() {
      scene.remove(group);
      const mats = new Set();
      group.traverse(object => {
        if (object.geometry) object.geometry.dispose();
        if (object.material) {
          for (const mat of Array.isArray(object.material) ? object.material : [object.material]) mats.add(mat);
        }
      });
      for (const mat of mats) mat.dispose();
    }
  };
}
