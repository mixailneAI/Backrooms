import { createInput } from './input.js';
import { createCamera } from './camera.js';
import { createSave } from './save.js';
import { createInteract } from './interact.js';
import { createLoop } from './loop.js';
import { manualAdapter, moveWithSlide } from './physics.js';
import { bus } from '../core/events.js';
export function createGame(ctx) {
  const { render, save, hud, onState, THREE } = ctx;
  const input = createInput();
  const camera = createCamera();
  const interact = createInteract();
  const events = bus();
  let manualWorld = null;
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
  let inventory = { water: 0, notes: 0 };
  const lastStep = { x: 0, z: 0 };
  function resetRunState() {
    sanity = 100;
    stamina = 100;
    inventory = { water: 0, notes: 0 };
    time = 0;
    lastMoving = false;
  }
  function state() {
    return { sanity, stamina, inventory: { water: inventory.water, notes: inventory.notes } };
  }
  function setSprint(v) {
    sprintHeld = !!v;
    if (input.setSprint) input.setSprint(sprintHeld);
    events.emit('sprint', { on: sprintHeld });
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
    if (render && render.applyFog) render.applyFog(biome);
    if (manualWorld) { manualWorld.dispose(); manualWorld = null; colliderAdapter = null; }
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
    const prog = save && save.progress ? save.progress() : null;
    inventory.notes = prog && prog.notes && prog.notes[levelId] ? prog.notes[levelId].length : 0;
    hud && hud.setLevel(level.name || level.id);
    hud && hud.setStats && hud.setStats(state());
    events.emit('level-loaded', { id: level.id, config });
  }
  function tickPlayerState(dt) {
    const mv = input.move;
    lastMoving = Math.hypot(mv.x, mv.z) > 0.05;
    camera.update(dt, input, lastMoving);
    if (manualWorld && colliderAdapter) {
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
      const raw = Number((save && save.settings().sens) || 1);
      const sens = Math.min(10, Math.max(1, raw));
      const mult = 0.0066 * Math.sqrt(sens);
      camera.addLook(look.x, look.y, mult);
    }
  }
  function tick(dt) {
    if (!running || paused || disposed) return;
    time += dt;
    tickPlayerState(dt);
    hud && hud.setTime(time);
    if ((input.sprint || sprintHeld) && lastMoving && stamina > 0) stamina -= 20 * dt;
    else stamina += 12 * dt;
    stamina = Math.max(0, Math.min(100, stamina));
    if (stamina <= 0 && (input.sprint || sprintHeld)) setSprint(false);
    let drain = (config && config.sanityDrain) || 0;
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
    const actions = input.consumeActions();
    for (const a of actions) {
      if (a === 'interact') {
        const n = interact.nearest(p.x, p.z);
        if (n) doInteract(n);
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
      item.taken = true;
      hideItem(item);
      const loreIndex = item.data && item.data.loreIndex != null ? item.data.loreIndex : null;
      const added = save && save.addNote ? save.addNote(levelId, item.id) : false;
      if (added) inventory.notes++;
      const lore = loreIndex != null && config && config.lore ? config.lore[loreIndex] : null;
      events.emit('note-taken', { item, loreIndex, lore, inventory: state().inventory });
      return;
    }
    if (item.type === 'item') {
      item.taken = true;
      hideItem(item);
      const add = Number(item.data && item.data.water) || 1;
      inventory.water += add;
      events.emit('item-taken', { item, add, inventory: state().inventory });
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
    services: { interact },
    get config() { return config; },
    get levelId() { return levelId; },
    get time() { return time; },
    get running() { return running; },
    get paused() { return paused; },
    manualWorld: () => manualWorld,
    colliderAdapter: () => colliderAdapter,
    tickPlayerState,
    setSprint,
    state,
    loadLevel(level) {
      if (!level || typeof level !== 'object') throw new Error('loadLevel: нет уровня');
      if (level.chunked) {
        resetRunState();
        config = { id: level.id, seed: level.seed || 1, chunked: true, biome: level.biome || null, story: level.story || null, lore: level.lore || [], ambient: level.ambient || null, sanityDrain: level.sanityDrain || 0, stepSurface: level.stepSurface || 'carpet' };
        manualWorld = null;
        colliderAdapter = null;
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
    },
    pause() {
      if (!running || paused) return;
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
      const n = interact.nearest(p.x, p.z);
      if (n) { doInteract(n); return true; }
      return false;
    },
    die,
    win
  };
}
