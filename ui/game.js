import { parseId, fatal, gestureUnlock, homeButton } from '../engine/boot.js';
import { createRender } from '../engine/render.js';
import { createGame } from '../engine/game.js';
import { createSave } from '../engine/save.js';
import { createHud } from '../engine/hud.js';
import { levels, byId } from '../levels/all.js';

const $ = id => document.getElementById(id);
const JOY_RADIUS = 56;
const LOOK_SCALE = 0.9;
const touchPointers = new Map();

function isTouchDevice() {
  return 'ontouchstart' in window || (navigator.maxTouchPoints || 0) > 0;
}

function vibrate(save) {
  try {
    const s = save.settings();
    if (s && s.vibration && navigator.vibrate) navigator.vibrate(15);
  } catch (e) {}
}

function enterFullscreen(doc) {
  try {
    const el = doc.documentElement;
    const req = el.requestFullscreen || el.webkitRequestFullscreen || el.msRequestFullscreen;
    if (req) {
      const p = req.call(el);
      if (p && typeof p.catch === 'function') p.catch(() => {});
    }
  } catch (e) {}
}

function exitFullscreen(doc) {
  try {
    if (doc.fullscreenElement && typeof doc.exitFullscreen === 'function') {
      const p = doc.exitFullscreen();
      if (p && typeof p.catch === 'function') p.catch(() => {});
    }
  } catch (e) {}
}

function setupTouch(canvas, input) {
  const half = () => window.innerWidth / 2;

  canvas.addEventListener('pointerdown', e => {
    if (e.pointerType !== 'touch') return;
    e.preventDefault();
    const left = e.clientX < half();
    touchPointers.set(e.pointerId, { left, x: e.clientX, y: e.clientY, ox: e.clientX, oy: e.clientY });
    if (left) input.setJoystick(0, 0);
  }, { passive: false });

  canvas.addEventListener('pointermove', e => {
    if (e.pointerType !== 'touch') return;
    const p = touchPointers.get(e.pointerId);
    if (!p) return;
    e.preventDefault();

    if (p.left) {
      const dx = e.clientX - p.ox;
      const dy = e.clientY - p.oy;
      const len = Math.hypot(dx, dy);
      if (len > 0) {
        const s = Math.min(len, JOY_RADIUS) / JOY_RADIUS;
        input.setJoystick((dx / len) * s, (dy / len) * s);
      }
    } else {
      const dx = e.clientX - p.x;
      const dy = e.clientY - p.y;
      p.x = e.clientX;
      p.y = e.clientY;
      input.addLook(dx * LOOK_SCALE, dy * LOOK_SCALE);
    }
  }, { passive: false });

  const release = e => {
    if (e.pointerType !== 'touch') return;
    const p = touchPointers.get(e.pointerId);
    if (p && p.left) input.setJoystick(0, 0);
    touchPointers.delete(e.pointerId);
  };

  canvas.addEventListener('pointerup', release);
  canvas.addEventListener('pointercancel', release);
  canvas.addEventListener('pointerleave', release);
}

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

    const showOverlay = (id, show) => {
      const el = $(id);
      if (el) el.hidden = !show;
    };
    const closeSettings = () => showOverlay('settings', false);

    const game = createGame({
      render,
      save,
      hud,
      THREE,
      worldModule: await import('../world/manual.js'),
      onState(state, detail) {
        showOverlay('pause', state === 'pause');
        showOverlay('death', state === 'death');
        showOverlay('win', state === 'win');
        if (state === 'play') closeSettings();
        if (state === 'death') {
          const c = $('death-cause');
          if (c) c.textContent = (detail && detail.cause) || '';
        }
        document.body.classList.toggle('ui-open', state !== 'play');
      }
    });

    document.body.classList.add('ui-open');

    $('pause-resume').addEventListener('click', () => {
      vibrate(save);
      enterFullscreen(document);
      closeSettings();
      game.resume();
    });

    $('pause-settings').addEventListener('click', () => {
      vibrate(save);
      showOverlay('pause', false);
      showOverlay('settings', true);
    });

    $('settings-close').addEventListener('click', () => {
      vibrate(save);
      closeSettings();
      showOverlay('pause', true);
    });

    $('pause-fullscreen').addEventListener('click', () => {
      vibrate(save);
      enterFullscreen(document);
    });

    $('pause-btn').addEventListener('click', () => {
      vibrate(save);
      game.pause();
    });

    $('prompt').addEventListener('click', () => {
      vibrate(save);
      game.interact();
    });

    const range = $('sens-range');
    const val = $('sens-val');
    const sens = Number((save.settings().sens) || 1);
    if (range) {
      range.value = String(Math.min(3, Math.max(0.3, sens)));
      if (val) val.textContent = Number(range.value).toFixed(2);
    }
    if (range) {
      range.addEventListener('input', () => {
        const v = Math.min(3, Math.max(0.3, Number(range.value)));
        if (val) val.textContent = v.toFixed(2);
        save.setSettings({ sens: v });
      });
    }

    $('death-retry').addEventListener('click', () => {
      game.loadLevel(level);
      game.start();
      showOverlay('death', false);
    });

    $('win-next').addEventListener('click', () => {
      const next = game.config && game.config.story && game.config.story.next;
      const nextLevel = next && byId[next];
      if (nextLevel) {
        showOverlay('win', false);
        game.loadLevel(nextLevel);
        game.start();
      } else {
        exitFullscreen(document);
        location.href = './index.html';
      }
    });

    homeButton(document);

    setupTouch(canvas, game.input);

    canvas.addEventListener('pointerdown', e => {
      if (e.pointerType === 'mouse' && document.pointerLockElement !== canvas) {
        try {
          const p = canvas.requestPointerLock();
          if (p && typeof p.catch === 'function') p.catch(() => {});
        } catch (err) {}
      }
    });

    canvas.addEventListener('pointermove', e => {
      if (e.pointerType === 'mouse' && document.pointerLockElement === canvas) {
        game.input.addLook(e.movementX, e.movementY);
      }
    });

    window.addEventListener('keydown', e => {
      if (e.code === 'Escape') {
        if (game.paused) {
          closeSettings();
          game.resume();
        } else {
          game.pause();
        }
      }
      game.input.setKey(e.code, true, e.repeat);
    });

    window.addEventListener('keyup', e => game.input.setKey(e.code, false));

    gestureUnlock(window, () => {
      document.body.classList.remove('ui-open');
      const hint = $('touch-hint');
      if (hint && isTouchDevice()) {
        hint.hidden = false;
        setTimeout(() => { hint.hidden = true; }, 6000);
      }
      enterFullscreen(document);
      game.loadLevel(level);
      game.start();
    });

    window.__BR_GAME__ = game;
  } catch (e) {
    fatal(document, e);
  }
}

main();
