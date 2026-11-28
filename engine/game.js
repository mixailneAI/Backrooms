import { createInput } from './input.js';
import { createCamera } from './camera.js';
import { createSave } from './save.js';
import { createInventory } from './inventory.js';
import { createInteract } from './interact.js';
import { createLoop } from './loop.js';
import { manualAdapter, moveWithSlide } from './physics.js';
import { bus } from '../core/events.js';
export function createGame(ctx) {
  const { render, save, hud, onState, THREE } = ctx;
  const readSettings = () => save && (typeof save.settings === 'function' ? save.settings() : save.settings) || {};
  const input = createInput();
  const camera = createCamera();
  const interact = createInteract();
  const events = bus();
  let manualWorld = null;
  let chunkWorld = null;
  let colliderAdapter = null;
  let config = null;
  let levelId = null;
  let running = false;
  let paused = false;
  let disposed = false;
  let time = 0;
  let lastMoving = false;
  let sprintHeld = false;
  let sanity = 100;
  let stamina = 100;
  const inventory = createInventory(save);
  let localArrows = save && Number.isFinite(Number(save.arrows)) ? Math.max(0, Math.floor(Number(save.arrows))) : 5;
  const ARROWS_ENABLED = false; const arrowMeshes = [];
  let previewArrow = null;
  let arrowTexture = null;
  let arrowGesture = false;
  const lastStep = { x: 0, z: 0 };
  function resetRunState() {
    input.reset?.();
    sprintHeld = false;
    events.emit('sprint', { on: false });
    sanity = 100;
    stamina = 100;
    time = 0;
    lastMoving = false;
  }
  function getArrowCount() {
    return save && Number.isFinite(Number(save.arrows)) ? Math.max(0, Math.floor(Number(save.arrows))) : localArrows;
  }
  function addArrows(amount) {
    const add = Math.max(0, Math.floor(Number(amount) || 0));
    if (save && typeof save.addArrows === 'function') localArrows = save.addArrows(add);
    else if (save && 'arrows' in save) { save.arrows = getArrowCount() + add; localArrows = getArrowCount(); }
    else localArrows += add;
    return getArrowCount();
  }
  function spendArrow() {
    if (save && typeof save.spendArrow === 'function') {
      const spent = save.spendArrow(1);
      localArrows = getArrowCount();
      return spent;
    }
    if (getArrowCount() <= 0) return false;
    if (save && 'arrows' in save) save.arrows = getArrowCount() - 1;
    else localArrows--;
    return true;
  }
  function state() {
    const counts = {
      water: inventory.count('water'),
      notes: inventory.count('note'),
      food: inventory.count('food'),
      spraycan: inventory.count('spraycan'),
      slots: inventory.slots(),
      activeSlot: inventory.getActiveIndex(),
      hasBackpack: inventory.hasBackpack()
    };
    const progress = save && typeof save.progress === 'function' ? save.progress() : null;
    const savedNotes = progress && progress.notes && progress.notes[levelId] ? progress.notes[levelId].length : 0;
    counts.notes = Math.max(counts.notes, savedNotes);
    return { sanity, stamina, inventory: counts, arrows: getArrowCount() };
  }
  function setSprint(v) {
    sprintHeld = !!v;
    if (input.setSprint) input.setSprint(sprintHeld);
    events.emit('sprint', { on: sprintHeld });
  }
  function getArrowTexture() {
    if (arrowTexture) return arrowTexture;
    if (!THREE || typeof document === 'undefined' || !THREE.CanvasTexture) return null;
    const canvas = document.createElement('canvas');
    canvas.width = 96;
    canvas.height = 144;
    const context = canvas.getContext('2d');
    if (!context) return null;
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = '#7fff9f';
    context.shadowColor = '#7fff9f';
    context.shadowBlur = 12;
    context.beginPath();
    context.moveTo(48, 7);
    context.lineTo(91, 61);
    context.lineTo(67, 61);
    context.lineTo(67, 137);
    context.lineTo(29, 137);
    context.lineTo(29, 61);
    context.lineTo(5, 61);
    context.closePath();
    context.fill();
    arrowTexture = new THREE.CanvasTexture(canvas);
    arrowTexture.colorSpace = THREE.SRGBColorSpace;
    arrowTexture.needsUpdate = true;
    return arrowTexture;
  }
  function createArrowMesh(opacity = 0.85) {
    if (!THREE || !render || !render.scene) return null;
    const texture = getArrowTexture();
    let geometry;
    let material;
    if (texture && THREE.PlaneGeometry) {
      geometry = new THREE.PlaneGeometry(0.48, 0.72);
      material = new THREE.MeshBasicMaterial({ color: '#7fff9f', map: texture, transparent: true, opacity, depthWrite: false, side: THREE.DoubleSide, alphaTest: 0.06 });
    } else if (THREE.Shape && THREE.ShapeGeometry) {
      const shape = new THREE.Shape();
      shape.moveTo(-0.055, -0.28);
      shape.lineTo(-0.055, 0.105);
      shape.lineTo(-0.16, 0.105);
      shape.lineTo(0, 0.34);
      shape.lineTo(0.16, 0.105);
      shape.lineTo(0.055, 0.105);
      shape.lineTo(0.055, -0.28);
      shape.closePath();
      geometry = new THREE.ShapeGeometry(shape);
      material = new THREE.MeshBasicMaterial({ color: '#7fff9f', transparent: true, opacity, depthWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2 });
    } else return null;
    const mesh = new THREE.Mesh(geometry, material);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y = 0.025;
    mesh.renderOrder = 4;
    return mesh;
  }
  function placeArrow(mesh) {
    if (!mesh) return;
    const p = camera.pos();
    const yaw = camera.yaw;
    const offset = 0.58;
    mesh.position.set(p.x - Math.sin(yaw) * offset, 0.025, p.z - Math.cos(yaw) * offset);
    mesh.rotation.set(-Math.PI / 2, yaw, 0);
  }
  function removeArrowMesh(mesh) {
    if (!mesh) return;
    render?.scene?.remove(mesh);
    mesh.geometry?.dispose?.();
    mesh.material?.dispose?.();
  }
  function clearArrowMeshes() {
    if (previewArrow) removeArrowMesh(previewArrow);
    previewArrow = null;
    for (const mesh of arrowMeshes) removeArrowMesh(mesh);
    arrowMeshes.length = 0;
    arrowTexture?.dispose?.();
    arrowTexture = null;
    arrowGesture = false;
  }
  function updateArrowDrawing() { if (!ARROWS_ENABLED) return;
    const held = !!input.isArrowDrawing;
    if (held && !arrowGesture) {
      arrowGesture = true;
      if (getArrowCount() > 0) {
        previewArrow = createArrowMesh(0.38);
        if (previewArrow) render.scene.add(previewArrow);
      } else {
        events.emit('arrow-empty', { arrows: 0 });
      }
    }
    if (held && previewArrow) placeArrow(previewArrow);
    if (!held && arrowGesture) {
      arrowGesture = false;
      if (previewArrow && spendArrow()) {
        removeArrowMesh(previewArrow);
        previewArrow = null;
        const mesh = createArrowMesh(0.85);
        if (mesh) {
          placeArrow(mesh);
          render.scene.add(mesh);
          arrowMeshes.push(mesh);
          while (arrowMeshes.length > 50) removeArrowMesh(arrowMeshes.shift());
          events.emit('arrow-placed', { arrows: getArrowCount(), placed: arrowMeshes.length });
        }
      } else if (previewArrow) {
        removeArrowMesh(previewArrow);
        previewArrow = null;
      }
    }
  }
  function useActiveItem() {
    const active = inventory.getActive();
    if (!active || active.type !== 'food' || stamina >= 100) return false;
    const consumed = inventory.consume(inventory.getActiveIndex(), 1);
    if (!consumed) return false;
    stamina = Math.min(100, stamina + 35);
    hud && hud.setStats && hud.setStats(state());
    events.emit('food-used', { item: consumed, restore: 35, stamina });
    return true;
  }
  function applyLevel(level) {
    levelId = level.id;
    const biome = level.biome || {};
    config = {
      id: level.id,
      seed: level.seed || 1,
      chunked: !!level.chunked,
      biome,
      story: level.story || null,
      lore: level.lore || [],
      ambient: level.ambient || biome.ambient || null,
      sanityDrain: level.sanityDrain || biome.sanityDrain || 0,
      stepSurface: level.stepSurface || biome.stepSurface || 'carpet'
    };
    resetRunState();
    clearArrowMeshes();
    if (render && render.applyFog) render.applyFog(biome);
    if (chunkWorld) { chunkWorld.dispose(); chunkWorld = null; } if (manualWorld) { manualWorld.dispose(); manualWorld = null; colliderAdapter = null; }
    interact.setItems([]);
    if (level.chunked) { manualWorld = null; colliderAdapter = null; return; }
    const createManualWorld = ctx.worldModule && ctx.worldModule.createManualWorld;
    if (typeof level.build === 'function' && render && render.scene && createManualWorld) {
      manualWorld = createManualWorld(THREE, render.scene, { bounds: biome.bounds || { w: 24, d: 24 }, height: biome.height || 3, palette: biome.palette || {} });
      level.build(manualWorld, config.seed, biome.palette || {});
      manualWorld.flush();
      interact.setItems(manualWorld.interactables);
      colliderAdapter = manualAdapter(manualWorld.colliders);
    }
    const spawn = manualWorld && manualWorld.spawns && manualWorld.spawns[0];
    if (spawn) { camera.setPos(spawn.x, spawn.z); lastStep.x = spawn.x; lastStep.z = spawn.z; }
    hud && hud.setLevel(level.name || level.id);
    hud && hud.setStats && hud.setStats(state());
    events.emit('level-loaded', { id: level.id, config });
  }
  function tickPlayerState(dt) {
    const mv = input.move;
    lastMoving = Math.hypot(mv.x, mv.z) > 0.05;
    camera.update(dt, input, lastMoving);
    if (colliderAdapter && (manualWorld || chunkWorld)) {
      const sprinting = input.sprint || sprintHeld;
      const speed = (sprinting ? 5.2 : input.crouch ? 1.8 : 3.2) * dt;
      const yaw = camera.yaw;
      const dx = (Math.sin(yaw) * mv.z + Math.cos(yaw) * mv.x) * speed;
      const dz = (Math.cos(yaw) * mv.z - Math.sin(yaw) * mv.x) * speed;
      const p = camera.pos();
      const np = moveWithSlide(p, dx, dz, colliderAdapter, 0.3);
      camera.setPos(np.x, np.z);
      const moved = Math.hypot(np.x - lastStep.x, np.z - lastStep.z);
      if (lastMoving && moved > 0.85) {
        lastStep.x = np.x;
        lastStep.z = np.z;
        events.emit('step', { surface: config && config.stepSurface });
      }
    }
    camera.applyTo(render && render.camera);
    const look = input.consumeLook();
    if (look.x || look.y) {
      const raw = Number(readSettings().sens ?? readSettings().sensitivity ?? 1);
      const sens = Math.min(10, Math.max(1, raw));
      const mult = 0.0066 * Math.sqrt(sens);
      camera.addLook(look.x, look.y, mult);
    }
  }
  function tick(dt) {
    if (!running || paused || disposed) return;
    time += dt;
    tickPlayerState(dt);
    updateArrowDrawing();
    hud && hud.setTime(time);
    if ((input.sprint || sprintHeld) && lastMoving && stamina > 0) stamina -= 20 * dt;
    else stamina += 12 * dt;
    stamina = Math.max(0, Math.min(100, stamina));
    if (stamina <= 0 && (input.sprint || sprintHeld)) setSprint(false);
    const depth = config && config.chunked ? Math.floor(Math.hypot(camera.pos().x, camera.pos().z) / 16) : 0;
     if (depth && hud && hud.setLevel) hud.setLevel('Бездна · глубина ' + depth);
     let drain = (config && config.sanityDrain) || 0;
     if (config && config.chunked) drain *= 1 + depth * 0.06;
    if (stamina < 25) drain *= 1.8;
    sanity -= drain * 0.12 * dt;
    sanity = Math.max(0, Math.min(100, sanity));
    if (sanity <= 0) { die('рассудок исчерпан'); return; }
    hud && hud.setStats && hud.setStats(state());
    const p = camera.pos();
    let prompt = null;
    try {
      const c = interact.context(p.x, p.z);
      if (c && c.label) prompt = c.label;
    } catch (e) {
      const n = interact.nearest(p.x, p.z);
      if (n) prompt = n.label || n.type;
    }
    hud && hud.setPrompt(prompt);
    manualWorld?.update?.(time); if (chunkWorld) { const cp = camera.pos(); chunkWorld.pos.x = cp.x; chunkWorld.pos.z = cp.z; chunkWorld.stream(); interact.setItems(chunkWorld.interactables || []); }
    const actions = input.consumeActions();
    for (const a of actions) {
      if (a === 'interact') {
        const n = interact.nearest(p.x, p.z);
        if (n) doInteract(n);
      } else if (a === 'useItem') {
        useActiveItem();
      }
    }
    render && render.render();
  }
  function disableCollider(index) {
    if (!manualWorld || index == null) return;
    const c = manualWorld.colliders[index];
    if (c) { c.x = 1e9; c.z = 1e9; c.w = 0; c.d = 0; c.passable = true; }
  }
  function hideItem(item) { if (item && item.mesh) item.mesh.visible = false; }
  function doInteract(item) {
    if (!item) return;
    if (item.taken && item.type !== 'exit') return;
    events.emit('interact', item);
    if (item.type === 'exit') {
      if (config && config.story && (config.story.next || config.story.final)) {
        hideItem(item);
        events.emit('exit', { next: config.story.next || null, final: !!config.story.final });
        win();
      }
      return;
    }
    if (item.type === 'note') {
      const progress = save && typeof save.progress === 'function' ? save.progress() : null;
      const knownNotes = progress && progress.notes && progress.notes[levelId] || [];
      const alreadyKnown = knownNotes.includes(item.id);
      if (!alreadyKnown && inventory.add({ id: item.id, type: 'note', count: 1, data: item.data }) < 0) {
        events.emit('inventory-full', { item });
        return;
      }
      item.taken = true;
      hideItem(item);
      const loreIndex = item.data && item.data.loreIndex != null ? item.data.loreIndex : null;
      const added = save && save.addNote ? save.addNote(levelId, item.id) : !alreadyKnown;
      const lore = loreIndex != null && config && config.lore ? config.lore[loreIndex] : null;
      events.emit('note-taken', { item, loreIndex, lore, added, inventory: state().inventory });
      return;
    }
    if (item.type === 'item') {
      const kind = item.data && item.data.kind || 'bottle';
      const type = kind === 'bottle' ? 'water' : kind;
      const add = type === 'water' ? Math.max(1, Math.floor(Number(item.data && item.data.water) || 1)) : Math.max(1, Math.floor(Number(item.data && item.data.count) || 1));
      const slotIndex = inventory.add({ id: item.id, type, count: add, data: item.data });
      if (slotIndex < 0) {
        events.emit('inventory-full', { item });
        return;
      }
      item.taken = true;
      hideItem(item);
      if (chunkWorld && chunkWorld.taken) chunkWorld.taken.add(item.id); if (type === 'spraycan') addArrows(add * 10);
      events.emit('item-taken', { item, type, add, slotIndex, arrows: getArrowCount(), inventory: state().inventory });
      return;
    }
    if (item.type === 'door') {
      item.taken = true;
      hideItem(item);
      if (item.data && item.data.colliderIndex != null) disableCollider(item.data.colliderIndex);
      events.emit('door-open', { item });
      return;
    }
    if (item.type === 'noclip') {
      item.taken = true;
      hideItem(item);
      if (item.data && item.data.colliderIndex != null) disableCollider(item.data.colliderIndex);
      events.emit('noclip-open', { item });
    }
  }
  function win() {
    running = false;
    loop.stop();
    if (save) save.win();
    events.emit('win', { id: levelId });
    onState && onState('win');
  }
  function die(cause) {
    running = false;
    loop.stop();
    if (save) save.death();
    events.emit('die', { cause });
    onState && onState('death', { cause });
  }
  const loop = createLoop({ tick });
  return {
    input, camera, events,
    services: { interact, inventory },
    get config() { return config; },
    get levelId() { return levelId; },
    get time() { return time; },
    get running() { return running; },
    get paused() { return paused; },
    manualWorld: () => manualWorld,
    chunkWorld: () => chunkWorld,
    attachChunkWorld(world) { if (chunkWorld) chunkWorld.dispose(); chunkWorld = world; colliderAdapter = { isFree: (x, z) => world.isFree(x, z) }; const sp = world.playerPos(); camera.setPos(sp.x, sp.z); lastStep.x = sp.x; lastStep.z = sp.z; },
    colliderAdapter: () => colliderAdapter,
    tickPlayerState,
    setSprint,
    setArrowDrawing(value) { input.setArrowDrawing(!!value); },
    selectSlot(index) {
      const selected = inventory.selectSlot(index);
      if (selected) hud && hud.setStats && hud.setStats(state());
      return selected;
    },
    useActiveItem,
    state,
    loadLevel(level) {
      if (!level || typeof level !== 'object') throw new Error('loadLevel: нет уровня');
      if (level.chunked) {
        levelId = level.id;
        resetRunState();
        clearArrowMeshes();
        if (chunkWorld) { chunkWorld.dispose(); chunkWorld = null; } config = { id: level.id, seed: level.seed || 1, chunked: true, biome: level.biome || null, story: level.story || null, lore: level.lore || [], ambient: level.ambient || null, sanityDrain: level.sanityDrain || 0, stepSurface: level.stepSurface || 'carpet' };
        manualWorld = null;
        colliderAdapter = null;
        interact.setItems([]);
        if (render && render.applyFog) render.applyFog(level.biome || {});
        hud && hud.setLevel(level.name || level.id);
        hud && hud.setStats && hud.setStats(state());
        events.emit('level-loaded', { id: level.id, config });
        return;
      }
      applyLevel(level);
    },
    start() {
      if (running) return;
      running = true;
      paused = false;
      loop.start();
      events.emit('start', { id: levelId });
      onState && onState('play');
    },
    pause() {
      if (!running || paused) return;
      input.setArrowDrawing(false);
      paused = true;
      loop.stop();
      events.emit('pause');
      onState && onState('pause');
    },
    resume() {
      if (!running || !paused) return;
      paused = false;
      loop.start();
      events.emit('resume');
      onState && onState('play');
    },
    interact() {
      const p = camera.pos();
      const context = interact.context(p.x, p.z);
      if (!context) return false;
      const n = interact.nearest(p.x, p.z);
      if (n) { doInteract(n); return true; }
      return false;
    },
    die,
    win
  };
}
