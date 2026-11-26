import { makeTexturedClone } from './textures.js';
export function createManualWorld(THREE, scene, opts = {}) {
  const height = opts.height ?? 3;
  const bounds = opts.bounds || { w: 16, d: 16 };
  const worldPalette = opts.palette || {};
  const group = new THREE.Group();
  const colliders = [], interactables = [], spawns = [];
  const matCache = new Map();
  const tile = 2;
  function resolvePalette(type, override = {}) {
    const p = override || {};
    const wp = worldPalette || {};
    const mapped = type === 'wall' ? wp.wall : type === 'floor' ? wp.floor : type === 'ceiling' ? wp.ceiling : wp[type];
    const out = {};
    if (p.base) out.base = p.base;
    if (p.dark) out.dark = p.dark;
    if (p.light) out.light = p.light;
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
      matCache.set(key, new THREE.MeshStandardMaterial({ map, bumpMap: map, bumpScale: 0.018, roughness: 0.92, metalness: 0.02 }));
    }
    return matCache.get(key);
  }
  function box(o = {}) {
    const w = o.w ?? 1, h = o.h ?? height, d = o.d ?? 1;
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), o.mat || material(o.type || 'wall', o.palette, Math.max(w, d) / tile, h / tile));
    m.position.set(o.x || 0, (o.y ?? 0) + h / 2, o.z || 0);
    group.add(m);
    if (o.solid !== false) colliders.push({ x: o.x || 0, z: o.z || 0, w, d, passable: false });
    return m;
  }
  function plane(o, y, rot) {
    const w = o.w ?? 4, d = o.d ?? 4;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), o.mat || material(o.type || 'floor', o.palette, w / tile, d / tile));
    m.rotation.x = rot;
    m.position.set(o.x || 0, y, o.z || 0);
    group.add(m);
    return m;
  }
  function bottleMesh(color) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.13, 0.34, 14), new THREE.MeshStandardMaterial({ color, transparent: true, opacity: 0.72, roughness: 0.16, metalness: 0.03 }));
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.065, 0.075, 12), new THREE.MeshStandardMaterial({ color: '#2f8f5f', roughness: 0.55 }));
    cap.position.y = 0.205;
    const label = new THREE.Mesh(new THREE.CylinderGeometry(0.118, 0.118, 0.10, 14, 1, true), new THREE.MeshBasicMaterial({ color: '#f7f3d8', transparent: true, opacity: 0.58, side: THREE.DoubleSide }));
    label.position.y = 0.02;
    g.add(body, cap, label);
    return g;
  }
  function paperMesh() {
    const g = new THREE.Group();
    const sheet = new THREE.Mesh(new THREE.BoxGeometry(0.23, 0.014, 0.31), new THREE.MeshStandardMaterial({ color: '#f2e2a8', roughness: 0.86 }));
    sheet.rotation.y = 0.34;
    g.add(sheet);
    return g;
  }
  function exitFrame(color) {
    const g = new THREE.Group();
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.86 });
    const pillar = new THREE.BoxGeometry(0.18, 2.2, 0.18);
    const left = new THREE.Mesh(pillar, mat); left.position.set(-0.56, 1.1, 0);
    const right = new THREE.Mesh(pillar, mat); right.position.set(0.56, 1.1, 0);
    const top = new THREE.Mesh(new THREE.BoxGeometry(1.30, 0.18, 0.18), mat); top.position.set(0, 2.11, 0);
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(1.05, 2.0), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.16, side: THREE.DoubleSide }));
    glow.position.set(0, 1.08, 0);
    g.add(left, right, top, glow);
    return g;
  }
  function marker(o, type, color) {
    const kind = o.data && o.data.kind;
    let mesh, y = type === 'exit' ? 1.1 : 0.25;
    if (type === 'item' && kind === 'bottle') { mesh = bottleMesh(color); y = 0.22; }
    else if (type === 'note' && kind === 'paper') { mesh = paperMesh(); y = 0.18; }
    else if (type === 'exit' && kind === 'frame') { mesh = exitFrame(color); y = 0; }
    else mesh = new THREE.Mesh(new THREE.BoxGeometry(0.4, type === 'exit' ? 2.2 : 0.5, 0.4), new THREE.MeshBasicMaterial({ color }));
    mesh.position.set(o.x || 0, y, o.z || 0);
    group.add(mesh);
    interactables.push({ id: o.id || type + '_' + interactables.length, type, x: o.x || 0, z: o.z || 0, label: o.label, data: o.data, mesh });
    return mesh;
  }
  return {
    group, colliders, interactables, spawns, box, material,
    cylinder(o = {}) {
      const r = o.r ?? 0.3, h = o.h ?? height;
      const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 12), o.mat || material(o.type || 'concrete', o.palette, (r * 2) / tile, h / tile));
      m.position.set(o.x || 0, h / 2, o.z || 0);
      group.add(m);
      if (o.solid !== false) colliders.push({ x: o.x || 0, z: o.z || 0, w: r * 2, d: r * 2, passable: false });
      return m;
    },
    lightPanel(o = {}) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(o.w ?? 1.2, o.d ?? 0.6), new THREE.MeshBasicMaterial({ color: o.color || '#fff2b0' }));
      m.rotation.x = Math.PI / 2;
      m.position.set(o.x || 0, height - 0.02, o.z || 0);
      group.add(m);
      return m;
    },
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
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshStandardMaterial({ map: makeTexturedClone(THREE, 'water', resolvePalette('water', o.palette), w / tile, d / tile), transparent: true, opacity: 0.72, roughness: 0.22, metalness: 0.05 }));
      m.rotation.x = -Math.PI / 2;
      m.position.set(o.x || 0, o.y ?? 0.05, o.z || 0);
      group.add(m);
      return m;
    },
    lightColumn(o = {}) {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(o.r ?? 0.5, o.r ?? 0.5, height, 12, 1, true), new THREE.MeshBasicMaterial({ color: o.color || '#fff2b0', transparent: true, opacity: 0.18, side: THREE.DoubleSide }));
      m.position.set(o.x || 0, height / 2, o.z || 0);
      group.add(m);
      return m;
    },
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
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshStandardMaterial({ map: makeTexturedClone(THREE, 'panels', resolvePalette('panels', o.palette), Math.max(w, d) / tile, h / tile), transparent: true, opacity: 0.58, roughness: 0.8 }));
      m.position.set(o.x || 0, (o.y ?? 0) + h / 2, o.z || 0);
      group.add(m);
      colliders.push({ x: o.x || 0, z: o.z || 0, w, d, passable: false });
      const idx = colliders.length - 1;
      interactables.push({ id: o.id || 'noclip_' + interactables.length, type: 'noclip', x: o.x || 0, z: o.z || 0, label: o.label, data: { ...(o.data || {}), colliderIndex: idx }, mesh: m });
      return m;
    },
    freeCells() {
      const out = [];
      for (let x = -bounds.w / 2 + 1; x < bounds.w / 2; x++)
        for (let z = -bounds.d / 2 + 1; z < bounds.d / 2; z++) {
          let free = true;
          for (const c of colliders) {
            if (c.passable || c.x > 1e8) continue;
            if (Math.abs(x - c.x) < c.w / 2 + 0.4 && Math.abs(z - c.z) < c.d / 2 + 0.4) { free = false; break; }
          }
          if (free) out.push({ x, z });
        }
      return out;
    },
    flush() { scene.add(group); return group; },
    dispose() {
      scene.remove(group);
      const mats = new Set();
      group.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) mats.add(o.material); });
      for (const m of mats) m.dispose();
    }
  };
}
