import { chunkLayout, CHUNK, GATES, idx } from './chunkgen.js';
import { makeTexturedClone, makeDetailMaps } from './textures.js';
import { prng } from '../core/prng.js';
const keyOf = (cx, cz) => cx + '|' + cz;
export class ChunkWorld {
  constructor(THREE, cfg = {}, scene) {
    this.THREE = THREE; this.cfg = cfg; this.scene = scene;
    this.size = Number(cfg.chunkSize) || CHUNK;
    this.view = Math.max(1, Number(cfg.viewDistance) || 2);
    this.seed = cfg.seed ?? 1;
    this.biome = cfg.biome || {};
    this.height = this.biome.height || 3;
    this.chunks = new Map();
    this.matCache = new Map();
    this.taken = new Set();
    this.interactables = [];
    this.pos = { x: 4.5, z: 4.5 };
    this.yaw = 0;
    this.center = { cx: 0, cz: 0 };
    this.root = new THREE.Group();
    scene.add(this.root);
    this.stream(true);
  }
  paletteFor(type) {
    const v = (this.biome.palette || {})[type];
    return typeof v === 'string' ? { base: v } : (v || {});
  }
  material(type, rx, ry) {
    const k = type + '|' + rx + ',' + ry;
    if (this.matCache.has(k)) return this.matCache.get(k);
    const pal = this.paletteFor(type);
    const map = makeTexturedClone(this.THREE, type, pal, rx, ry);
    const det = makeDetailMaps(this.THREE, type, pal);
    const m = new this.THREE.MeshStandardMaterial({ map, bumpMap: det.bumpMap, bumpScale: 0.02, normalMap: det.normalMap, roughness: 0.92, metalness: 0.02 });
    this.matCache.set(k, m);
    return m;
  }
  pickupMesh(kind) {
    const T = this.THREE;
    const g = new T.Group();
    if (kind === 'water') {
      const glass = new T.MeshStandardMaterial({ color: '#bfefff', transparent: true, opacity: 0.55, roughness: 0.12, metalness: 0.02 });
      const body = new T.Mesh(new T.CylinderGeometry(0.11, 0.13, 0.32, 16), glass);
      const cap = new T.Mesh(new T.CylinderGeometry(0.055, 0.055, 0.06, 12), new T.MeshStandardMaterial({ color: '#477d4d', roughness: 0.6 }));
      cap.position.y = 0.19;
      g.add(body, cap);
    } else if (kind === 'food') {
      const meat = new T.Mesh(new T.CylinderGeometry(0.13, 0.15, 0.07, 16), new T.MeshStandardMaterial({ color: '#c98a3a', roughness: 0.75 }));
      const bone = new T.Mesh(new T.CylinderGeometry(0.025, 0.03, 0.16, 8), new T.MeshStandardMaterial({ color: '#e8d9b8', roughness: 0.9 }));
      bone.rotation.z = Math.PI / 2.6; bone.position.set(0.14, 0.02, 0);
      g.add(meat, bone);
    } else {
      const body = new T.Mesh(new T.CylinderGeometry(0.085, 0.085, 0.3, 16), new T.MeshStandardMaterial({ color: '#e8d27a', roughness: 0.5, metalness: 0.2 }));
      const cap = new T.Mesh(new T.CylinderGeometry(0.05, 0.06, 0.07, 12), new T.MeshStandardMaterial({ color: '#554321', roughness: 0.55 }));
      cap.position.y = 0.185;
      g.add(body, cap);
    }
    g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    return g;
  }
  buildChunk(cx, cz) {
    const T = this.THREE, S = this.size;
    const layout = chunkLayout(this.seed, cx, cz);
    const g = new T.Group();
    g.position.set(cx * S, 0, cz * S);
    const floor = new T.Mesh(new T.PlaneGeometry(S, S), this.material('floor', S / 2, S / 2));
    floor.rotation.x = -Math.PI / 2; floor.position.set(S / 2, 0, S / 2);
    const ceil = new T.Mesh(new T.PlaneGeometry(S, S), this.material('ceiling', S / 2, S / 2));
    ceil.rotation.x = Math.PI / 2; ceil.position.set(S / 2, this.height, S / 2);
    g.add(floor, ceil);
    const cells = [];
    for (let z = 0; z < S; z++) for (let x = 0; x < S; x++) if (layout.walls[idx(x, z)]) cells.push([x, z]);
    const inst = new T.InstancedMesh(new T.BoxGeometry(1, this.height, 1), this.material('wall', 1, this.height / 2), cells.length);
    const m4 = new T.Matrix4();
    cells.forEach(([x, z], i) => { m4.makeTranslation(x + 0.5, this.height / 2, z + 0.5); inst.setMatrixAt(i, m4); });
    inst.instanceMatrix.needsUpdate = true;
    g.add(inst);
    const lamp = new T.Mesh(new T.PlaneGeometry(1.4, 0.7), new T.MeshBasicMaterial({ color: '#fff2b0' }));
    lamp.rotation.x = Math.PI / 2; lamp.position.set(4.5, this.height - 0.02, 4.5);
    g.add(lamp);
    const r = prng('items|' + this.seed + '|' + cx + '|' + cz);
    const kinds = ['water', 'food', 'spraycan'];
    const items = [];
    const n = r.int(3);
    for (let i = 0; i < n; i++) {
      const gx = GATES[r.int(2)], gz = GATES[r.int(2)];
      const id = 'ab_' + cx + '_' + cz + '_' + i;
      if (this.taken.has(id)) continue;
      const kind = kinds[r.int(3)];
      const mesh = this.pickupMesh(kind);
      mesh.position.set(gx + 0.5, 0.2, gz + 0.5);
      g.add(mesh);
      items.push({ id, type: 'item', x: cx * S + gx + 0.5, z: cz * S + gz + 0.5, data: { kind, water: 1, count: 1 }, mesh, taken: false });
    }
    this.root.add(g);
    this.chunks.set(keyOf(cx, cz), { cx, cz, group: g, layout, items });
    this.interactables = [...this.chunks.values()].flatMap(c => c.items);
  }
  stream(force = false) {
    const S = this.size;
    const cx = Math.floor(this.pos.x / S), cz = Math.floor(this.pos.z / S);
    if (!force && cx === this.center.cx && cz === this.center.cz) return;
    this.center = { cx, cz };
    const need = new Set();
    for (let dx = -this.view; dx <= this.view; dx++) for (let dz = -this.view; dz <= this.view; dz++) need.add(keyOf(cx + dx, cz + dz));
    for (const [k, c] of [...this.chunks]) if (!need.has(k)) {
      this.root.remove(c.group);
      c.group.traverse(o => { o.geometry?.dispose?.(); });
      for (const it of c.items) it.mesh.traverse(m => { if (m.isMesh) m.material?.dispose?.(); });
      this.chunks.delete(k);
    }
    for (const k of need) if (!this.chunks.has(k)) { const [a, b] = k.split('|').map(Number); this.buildChunk(a, b); }
    this.interactables = [...this.chunks.values()].flatMap(c => c.items);
  }
  cellAt(x, z) {
    const S = this.size;
    const cx = Math.floor(x / S), cz = Math.floor(z / S);
    return chunkLayout(this.seed, cx, cz).walls[idx(Math.floor(x - cx * S), Math.floor(z - cz * S))] === 0;
  }
  isFree(x, z) {
    const r = 0.3;
    return this.cellAt(x - r, z - r) && this.cellAt(x + r, z - r) && this.cellAt(x - r, z + r) && this.cellAt(x + r, z + r);
  }
  hasFloorAt(x, z) {
    const S = this.size;
    return this.chunks.has(keyOf(Math.floor(x / S), Math.floor(z / S)));
  }
  playerPos() { return { x: this.pos.x, z: this.pos.z }; }
  update(dt, input, engine) {
    engine?.tickPlayerState?.(dt);
    const mv = input?.move || { x: 0, z: 0 };
    const speed = (input?.sprint ? 5.2 : input?.crouch ? 1.8 : 3.2) * dt;
    const dx = (Math.sin(this.yaw) * mv.z + Math.cos(this.yaw) * mv.x) * speed;
    const dz = (Math.cos(this.yaw) * mv.z - Math.sin(this.yaw) * mv.x) * speed;
    if (dx && this.isFree(this.pos.x + dx, this.pos.z)) this.pos.x += dx;
    if (dz && this.isFree(this.pos.x, this.pos.z + dz)) this.pos.z += dz;
    this.stream();
  }
  dispose() {
    for (const [, c] of this.chunks) {
      this.root.remove(c.group);
      c.group.traverse(o => { o.geometry?.dispose?.(); });
      for (const it of c.items) it.mesh.traverse(m => { if (m.isMesh) m.material?.dispose?.(); });
    }
    this.chunks.clear();
    this.interactables = [];
    for (const m of this.matCache.values()) m.dispose();
    this.matCache.clear();
    this.scene.remove(this.root);
  }
}
