import { createInput } from './input.js';
import { createCamera } from './camera.js';
import { createSave } from './save.js';
import { createInteract } from './interact.js';
import { createLoop, MAX_DT } from './loop.js';
import { manualAdapter, chunkAdapter, moveWithSlide } from './physics.js';
import { bus } from '../core/events.js';

// Фасад игры (4.4). Контракт методов: loadLevel, start, pause, resume, tickPlayerState, interact, die, win.
// Делегат tickPlayerState ОБЯЗАН вызываться в обоих режимах (граф 9: «заморожено в чанках»).
// В loadLevel: конфиг присваивается ДО возврата из чанк-ветки (граф 14).
// manualWorld обнуляется в чанк-ветке (граф 14).
export function createGame(ctx) {
  const { render, save, hud, onState, THREE } = ctx;
  const input = createInput();
  const camera = createCamera();
  const interact = createInteract();
  const events = bus();
  let manualWorld = null;
  let config = null;
  let levelId = null;
  let running = false;
  let paused = false;
  let time = 0;
  let disposed = false;

  function applyLevel(level) {
    levelId = level.id;
    config = { id: level.id, seed: level.seed || 1, chunked: !!level.chunked, biome: level.biome || null, story: level.story || null };
    if (render && render.applyFog) render.applyFog(level.biome || {});
    if (manualWorld) { manualWorld.dispose(); manualWorld = null; }
    if (level.chunked) {
      // чанк-режим: world создаётся из ChunkWorld в M2; здесь заглушка контракта.
      manualWorld = null;
    } else if (typeof level.build === 'function' && render && render.scene) {
      const { createManualWorld } = ctx.worldModule || {};
      if (createManualWorld) {
        manualWorld = createManualWorld(THREE, render.scene, { bounds: (level.biome || {}).bounds || { w: 24, d: 24 } });
        level.build(manualWorld, config.seed);
        manualWorld.flush();
        interact.setItems(manualWorld.interactables);
      }
    }
    const spawn = manualWorld && manualWorld.spawns && manualWorld.spawns[0];
    if (spawn) camera.setPos(spawn.x, spawn.z);
    hud && hud.setLevel(level.name || level.id);
    events.emit('level-loaded', { id: level.id });
  }

  function tickPlayerState(dt) {
    const moving = Math.hypot(input.move.x, input.move.z) > 0.05;
    camera.update(dt, input, moving);
    if (manualWorld) {
      const adapter = manualAdapter(manualWorld.colliders);
      const speed = (input.sprint ? 5.2 : input.crouch ? 1.8 : 3.2) * dt;
      const yaw = camera.yaw;
      const dx = (input.move.z * -Math.sin(yaw) + input.move.x * Math.cos(yaw)) * speed;
      const dz = (input.move.z * -Math.cos(yaw) - input.move.x * Math.sin(yaw)) * speed;
      const p = moveWithSlide(camera.pos(), dx, dz, adapter, 0.3);
      camera.setPos(p.x, p.z);
    }
    camera.applyTo(render && render.camera);
    const look = input.consumeLook();
    if (look.x || look.y) camera.addLook(look.x, look.y, (save && save.settings().sens) || 1);
  }

  function tick(dt) {
    if (!running || paused || disposed) return;
    time += dt;
    tickPlayerState(dt);
    hud && hud.setTime(time);
    const p = camera.pos();
    const nearest = interact.nearest(p.x, p.z);
    hud && hud.setPrompt(nearest ? nearest.label || nearest.type : null);
    const actions = input.consumeActions();
    for (const a of actions) {
      if (a === 'interact' && nearest) doInteract(nearest);
    }
    render && render.render();
  }

  function doInteract(item) {
    if (!item) return;
    events.emit('interact', item);
    if (item.type === 'exit' && config && config.story && (config.story.next || config.story.final)) {
      events.emit('exit', { next: config.story.next || null, final: !!config.story.final });
      win();
    } else if (item.type === 'note') {
      if (save && save.addNote(levelId, item.id)) events.emit('note-taken', item);
      item.taken = true;
    } else if (item.type === 'item') {
      item.taken = true;
      events.emit('item-taken', item);
    } else if (item.type === 'door') {
      events.emit('door', item);
    } else if (item.type === 'noclip') {
      events.emit('noclip', item);
    }
  }

  const loop = createLoop({ tick });

  function win() {
    running = false; loop.stop();
    if (save) save.win();
    events.emit('win', { id: levelId });
    onState && onState('win');
  }
  function die(cause) {
    running = false; loop.stop();
    if (save) save.death();
    events.emit('die', { cause });
    onState && onState('death', { cause });
  }

  return {
    input, camera, interact, events,
    get config() { return config; },
    get levelId() { return levelId; },
    get time() { return time; },
    get running() { return running; },
    get paused() { return paused; },
    manualWorld: () => manualWorld,
    tickPlayerState,
    loadLevel(level) {
      if (!level || typeof level !== 'object') throw new Error('loadLevel: нет уровня');
      if (level.chunked) {
        config = { id: level.id, seed: level.seed || 1, chunked: true, biome: level.biome || null, story: level.story || null };
        manualWorld = null;
        return;
      }
      applyLevel(level);
    },
    start() {
      if (running) return;
      running = true; paused = false; time = 0;
      loop.start();
      events.emit('start', { id: levelId });
    },
    pause() {
      if (!running || paused) return;
      paused = true; loop.stop();
      events.emit('pause');
      onState && onState('pause');
    },
    resume() {
      if (!running || !paused) return;
      paused = false; loop.start();
      events.emit('resume');
      onState && onState('play');
    },
    interact() { return doInteract(interact.nearest(camera.pos().x, camera.pos().z)); },
    die,
    win,
    dispose() {
      disposed = true; loop.stop();
      if (manualWorld) manualWorld.dispose();
      manualWorld = null;
    }
  };
}
