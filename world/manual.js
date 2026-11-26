import { makeTexturedClone } from './textures.js';

export function createManualWorld(THREE, scene, opts = {}) {
  const height = opts.height ?? 3;
  const bounds = opts.bounds || { w: 16, d: 16 };
  const group = new THREE.Group();
  const colliders = [], interactables = [], spawns = [];
  const matCache = new Map();
  const tile = 2;

  function material(type, palette = {}, rx = 1, ry = 1) {
    const key = type + '|' + JSON.stringify(palette) + '|' + rx + ',' + ry;
    if (!matCache.has(key)) {
      matCache.set(key, new THREE.MeshLambertMaterial({
        map: makeTexturedClone(THREE, type, palette, rx, ry)
      }));
    }
    return matCache.get(key);
  }

  function box(o = {}) {
    const w = o.w ?? 1, h = o.h ?? height, d = o.d ?? 1;
    const m = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, d),
      o.mat || material(o.type || 'wall', o.palette, Math.max(w, d) / tile, h / tile)
    );
    m.position.set(o.x || 0, (o.y ?? 0) + h / 2, o.z || 0);
    group.add(m);
    if (o.solid !== false) colliders.push({ x: o.x || 0, z: o.z || 0, w, d });
    return m;
  }

  function plane(o, y, rot) {
    const w = o.w ?? 4, d = o.d ?? 4;
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(w, d),
      o.mat || material(o.type || 'floor', o.palette, w / tile, d / tile)
    );
    m.rotation.x = rot;
    m.position.set(o.x || 0, y, o.z || 0);
    group.add(m);
    return m;
  }

  function marker(o, type, color) {
    const m = new THREE.Mesh(
      new THREE.BoxGeometry(0.4, type === 'exit' ? 2.2 : 0.5, 0.4),
      new THREE.MeshBasicMaterial({ color })
    );
    m.position.set(o.x || 0, type === 'exit' ? 1.1 : 0.25, o.z || 0);
    group.add(m);
    interactables.push({
      id: o.id || type + '_' + interactables.length,
      type,
      x: o.x || 0,
      z: o.z || 0,
      label: o.label,
      data: o.data
    });
    return m;
  }

  return {
    group, colliders, interactables, spawns, box, material,

    cylinder(o = {}) {
      const r = o.r ?? 0.3, h = o.h ?? height;
      const m = new THREE.Mesh(
        new THREE.CylinderGeometry(r, r, h, 12),
        o.mat || material(o.type || 'concrete', o.palette, (r * 2) / tile, h / tile)
      );
      m.position.set(o.x || 0, h / 2, o.z || 0);
      group.add(m);
      if (o.solid !== false) colliders.push({ x: o.x || 0, z: o.z || 0, w: r * 2, d: r * 2 });
      return m;
    },

    lightPanel(o = {}) {
      const m = new THREE.Mesh(
        new THREE.PlaneGeometry(o.w ?? 1.2, o.d ?? 0.6),
        new THREE.MeshBasicMaterial({ color: o.color || '#fff2b0' })
      );
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
      const m = new THREE.Mesh(
        new THREE.PlaneGeometry(w, d),
        new THREE.MeshLambertMaterial({
          map: makeTexturedClone(THREE, 'water', o.palette, w / tile, d / tile),
          transparent: true,
          opacity: 0.7
        })
      );
      m.rotation.x = -Math.PI / 2;
      m.position.set(o.x || 0, o.y ?? 0.05, o.z || 0);
      group.add(m);
      return m;
    },

    lightColumn(o = {}) {
      const m = new THREE.Mesh(
        new THREE.CylinderGeometry(o.r ?? 0.5, o.r ?? 0.5, height, 12, 1, true),
        new THREE.MeshBasicMaterial({
          color: o.color || '#fff2b0',
          transparent: true,
          opacity: 0.18,
          side: THREE.DoubleSide
        })
      );
      m.position.set(o.x || 0, height / 2, o.z || 0);
      group.add(m);
      return m;
    },

    spawn(o = {}) {
      spawns.push({ x: o.x || 0, z: o.z || 0 });
      return spawns[spawns.length - 1];
    },

    exit(o = {}) { return marker(o, 'exit', '#7fff9f'); },
    item(o = {}) { return marker(o, 'item', o.color || '#7fdfff'); },
    note(o = {}) { return marker(o, 'note', '#fff2b0'); },
    door(o = {}) { return marker(o, 'door', '#c9a24a'); },

    noclipWall(o = {}) {
      const w = o.w ?? 1, h = o.h ?? height, d = o.d ?? 1;
      const m = new THREE.Mesh(
        new THREE.BoxGeometry(w, h, d),
        new THREE.MeshLambertMaterial({
          map: makeTexturedClone(THREE, 'panels', o.palette, Math.max(w, d) / tile, h / tile),
          transparent: true,
          opacity: 0.6
        })
      );
      m.position.set(o.x || 0, (o.y ?? 0) + h / 2, o.z || 0);
      group.add(m);
      colliders.push({ x: o.x || 0, z: o.z || 0, w, d });
      interactables.push({
        id: o.id || 'noclip_' + interactables.length,
        type: 'noclip',
        x: o.x || 0,
        z: o.z || 0,
        label: o.label
      });
      return m;
    },

    freeCells() {
      const out = [];
      for (let x = -bounds.w / 2 + 1; x < bounds.w / 2; x++) {
        for (let z = -bounds.d / 2 + 1; z < bounds.d / 2; z++) {
          let free = true;
          for (const c of colliders) {
            if (Math.abs(x - c.x) < c.w / 2 + 0.4 && Math.abs(z - c.z) < c.d / 2 + 0.4) {
              free = false;
              break;
            }
          }
          if (free) out.push({ x, z });
        }
      }
      return out;
    },

    flush() {
      scene.add(group);
      return group;
    },

    dispose() {
      scene.remove(group);
      const mats = new Set();
      group.traverse(o => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) mats.add(o.material);
      });
      for (const m of mats) m.dispose();
    }
  };
}
