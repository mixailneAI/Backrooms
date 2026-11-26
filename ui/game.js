import { parseId, fatal, gestureUnlock, homeButton } from '../engine/boot.js';
import { createRender } from '../engine/render.js';
import { createGame } from '../engine/game.js';
import { createSave } from '../engine/save.js';
import { levels, byId } from '../levels/all.js';
import { createHud } from '../engine/hud.js';

// Точка входа игры. Импорты three.js идут через vendor (динамический, чтобы boot не падал на сервере).
const $ = id => document.getElementById(id);
async function main() {
  try {
    const levelId = parseId(location.search) || (levels[0] && levels[0].id);
    const level = levelId && byId[levelId];
    if (!level) { fatal(document, new Error('уровень не найден: ' + levelId)); return; }
    const THREE = await import('../vendor/three.module.js');
    const canvas = $('game');
    const render = createRender(THREE, canvas);
    const save = createSave();
    const hud = createHud(document);
    const showOverlay = (id, show) => { const el = $(id); if (el) el.hidden = !show; };
    const game = createGame({
      render, save, hud, THREE,
      worldModule: await import('../world/manual.js'),
      onState(state, detail) {
        showOverlay('pause', state === 'pause');
        showOverlay('death', state === 'death');
        showOverlay('win', state === 'win');
        if (state === 'death') { const c = $('death-cause'); if (c) c.textContent = (detail && detail.cause) || ''; }
      }
    });
    $('pause-resume').addEventListener('click', () => game.resume());
    $('death-retry').addEventListener('click', () => { game.loadLevel(level); game.start(); showOverlay('death', false); });
    $('win-next').addEventListener('click', () => {
      const next = game.config && game.config.story && game.config.story.next;
      const nextLevel = next && byId[next];
      if (nextLevel) { showOverlay('win', false); game.loadLevel(nextLevel); game.start(); }
      else location.href = './index.html';
    });
    $('prompt').addEventListener('click', () => game.interact());
    homeButton(document);
    window.addEventListener('keydown', e => {
      if (e.code === 'Escape') game.paused ? game.resume() : game.pause();
      game.input.setKey(e.code, true, e.repeat);
    });
    window.addEventListener('keyup', e => game.input.setKey(e.code, false));
    canvas.addEventListener('pointermove', e => { if (document.pointerLockElement === canvas) game.input.addLook(e.movementX, e.movementY); });
    canvas.addEventListener('click', () => { if (document.pointerLockElement !== canvas) canvas.requestPointerLock(); });
    gestureUnlock(window, () => { game.loadLevel(level); game.start(); });
    window.__BR_GAME__ = game;
  } catch (e) { fatal(document, e); }
}
main();
