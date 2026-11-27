import { parseId, fatal, gestureUnlock, homeButton } from '../engine/boot.js';
import { createRender } from '../engine/render.js';
import { createGame } from '../engine/game.js';
import { createSave } from '../engine/save.js';
import { createHud } from '../engine/hud.js';
import { createAudio } from '../engine/audio.js';
import { initSwUpdate } from './sw-update.js';
import { levels, byId } from '../levels/all.js';

const $ = id => document.getElementById(id);
const JOY_RADIUS = 58;
const LOOK_SCALE = 1;
const touchPointers = new Map();
const pressedControls = new Set();

function isTouchDevice() {
  return 'ontouchstart' in window || (navigator.maxTouchPoints || 0) > 0;
}
function readSettings(save) {
  return typeof save.settings === 'function' ? save.settings() : save.settings || {};
}
function vibrate(save) {
  try { if (readSettings(save).vibration && navigator.vibrate) navigator.vibrate(15); } catch {}
}
function enterFullscreen(doc) {
  try {
    const root = doc.documentElement;
    const request = root.requestFullscreen || root.webkitRequestFullscreen || root.msRequestFullscreen;
    if (!request) return;
    const result = request.call(root, { navigationUI: 'hide' });
    result?.catch?.(() => {
      try { request.call(root)?.catch?.(() => {}); } catch {}
    });
  } catch {}
}
function setJoyOrigin(x, y) {
  const joystick = $('joystick');
  if (joystick) {
    joystick.style.left = (x - 63) + 'px';
    joystick.style.top = (y - 63) + 'px';
    joystick.hidden = false;
  }
}
function setKnob(dx, dy) {
  const knob = $('joy-knob');
  if (knob) knob.style.transform = `translate(${dx}px,${dy}px)`;
}
function hideJoy() {
  const joystick = $('joystick'), knob = $('joy-knob');
  if (joystick) joystick.hidden = true;
  if (knob) knob.style.transform = 'translate(0px,0px)';
}
function setupTouch(canvas, input) {
  const split = () => window.innerWidth / 2;
  canvas.addEventListener('pointerdown', event => {
    if (event.pointerType !== 'touch') return;
    event.preventDefault();
    const left = event.clientX < split();
    touchPointers.set(event.pointerId, { left, x: event.clientX, y: event.clientY, originX: event.clientX, originY: event.clientY });
    if (left) {
      setJoyOrigin(event.clientX, event.clientY);
      input.setJoystick(0, 0);
    }
  }, { passive: false });
  canvas.addEventListener('pointermove', event => {
    if (event.pointerType !== 'touch') return;
    const pointer = touchPointers.get(event.pointerId);
    if (!pointer) return;
    event.preventDefault();
    if (pointer.left) {
      const dx = event.clientX - pointer.originX;
      const dy = event.clientY - pointer.originY;
      const length = Math.hypot(dx, dy);
      if (length > 0) {
        const magnitude = Math.min(length, JOY_RADIUS) / JOY_RADIUS;
        const capped = Math.min(length, JOY_RADIUS);
        setKnob(dx / length * capped, dy / length * capped);
        input.setJoystick(dx / length * magnitude, dy / length * magnitude);
      }
    } else {
      const dx = event.clientX - pointer.x;
      const dy = event.clientY - pointer.y;
      pointer.x = event.clientX;
      pointer.y = event.clientY;
      input.addLook(dx * LOOK_SCALE, dy * LOOK_SCALE);
    }
  }, { passive: false });
  const release = event => {
    if (event.pointerType !== 'touch') return;
    const pointer = touchPointers.get(event.pointerId);
    if (pointer?.left) { input.setJoystick(0, 0); hideJoy(); }
    touchPointers.delete(event.pointerId);
  };
  canvas.addEventListener('pointerup', release);
  canvas.addEventListener('pointercancel', release);
  canvas.addEventListener('lostpointercapture', release);
}
function bindPointerDown(element, callback) {
  if (!element) return;
  element.addEventListener('pointerdown', event => {
    if (event.button !== undefined && event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    const key = `${element.id}:${event.pointerId ?? 'primary'}`;
    if (pressedControls.has(key)) return;
    pressedControls.add(key);
    try { element.setPointerCapture?.(event.pointerId); } catch {}
    callback(event);
  });
  const release = event => {
    const key = `${element.id}:${event.pointerId ?? 'primary'}`;
    pressedControls.delete(key);
  };
  element.addEventListener('pointerup', release);
  element.addEventListener('pointercancel', release);
  element.addEventListener('lostpointercapture', release);
}

async function main() {
  try {
    const levelId = parseId(location.search) || levels[0]?.id;
    const level = levelId && byId[levelId];
    if (!level) { fatal(document, new Error('уровень не найден: ' + levelId)); return; }

    const THREE = await import('../vendor/three.module.js');
    const canvas = $('game');
    const save = createSave();
    const settings = readSettings(save);
    const render = createRender(THREE, canvas, { quality: settings.quality || 'medium', adaptive: settings.adaptive !== false });
    const hud = createHud(document);
    const audio = createAudio({ volume: settings.sound === false ? 0 : 0.35 });
    let noteOpen = false;
    let toastTimer = 0;
    let sprintOn = false;

    const showOverlay = (id, show) => { const element = $(id); if (element) element.hidden = !show; };
    document.addEventListener('pointerdown', event => {
      const button = event.target?.closest?.('button');
      if (button && button.id !== 'prompt' && button.id !== 'toast' && button.id !== 'update-toast') audio.click();
    }, true);

    const game = createGame({
      render, save, hud, THREE,
      worldModule: await import('../world/manual.js'),
      onState(state, detail) {
        showOverlay('pause', state === 'pause' && !noteOpen);
        showOverlay('death', state === 'death');
        showOverlay('win', state === 'win');
        if (state === 'play') showOverlay('settings', false);
        if (state === 'death') {
          const cause = $('death-cause');
          if (cause) cause.textContent = detail?.cause || '';
        }
        document.body.classList.toggle('ui-open', state !== 'play' || noteOpen);
      }
    });

    document.body.classList.add('ui-open');
    function showToast(message, kind = 'info') {
      const toast = $('toast');
      const label = $('toast-message');
      if (!toast) return;
      if (label) label.textContent = message;
      else toast.textContent = message;
      toast.dataset.kind = kind;
      toast.hidden = false;
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => { toast.hidden = true; }, 2400);
    }

    function openNote(lore) {
      noteOpen = true;
      const title = lore?.title || 'Записка';
      const text = lore?.text || 'Текст потерян. Гул лампы отвечает не сразу.';
      const titleNode = $('note-title'), textNode = $('note-text');
      if (titleNode) titleNode.textContent = title;
      if (textNode) textNode.textContent = text;
      showOverlay('note', true);
      document.body.classList.add('ui-open');
      game.pause();
    }
    function closeNote() {
      noteOpen = false;
      showOverlay('note', false);
      if (game.paused) game.resume();
    }
    function closeSettings() {
      showOverlay('settings', false);
      showOverlay('pause', true);
    }
    function applySound() {
      audio.setVolume(readSettings(save).sound === false ? 0 : 0.35);
    }

    bindPointerDown($('pause-resume'), () => {
      vibrate(save);
      enterFullscreen(document);
      showOverlay('settings', false);
      game.resume();
    });
    bindPointerDown($('pause-settings'), () => {
      vibrate(save);
      showOverlay('pause', false);
      showOverlay('settings', true);
    });
    bindPointerDown($('settings-close'), () => { vibrate(save); closeSettings(); });
    bindPointerDown($('pause-fullscreen'), () => { vibrate(save); enterFullscreen(document); });
    bindPointerDown($('pause-btn'), () => { vibrate(save); game.pause(); });
    bindPointerDown($('prompt'), () => {
      vibrate(save);
      if (!game.interact()) showToast('Рядом ничего нет');
    });
    bindPointerDown($('note-close'), () => { vibrate(save); closeNote(); });

    const sprintButton = $('sprint-btn');
    game.events.on('sprint', ({ on }) => {
      sprintOn = !!on;
      sprintButton?.classList.toggle('active', sprintOn);
      const label = $('sprint-label');
      if (label) label.textContent = sprintOn ? 'STOP' : 'RUN';
      sprintButton?.setAttribute('aria-pressed', String(sprintOn));
    });
    bindPointerDown(sprintButton, () => { vibrate(save); game.setSprint(!sprintOn); });

    const sensitivity = $('sens-range'), sensitivityValue = $('sens-val');
    const currentSensitivity = Math.min(10, Math.max(1, Number(readSettings(save).sens) || 1));
    if (sensitivity) {
      sensitivity.min = '1';
      sensitivity.max = '10';
      sensitivity.step = '0.1';
      sensitivity.value = String(currentSensitivity);
      if (sensitivityValue) sensitivityValue.textContent = currentSensitivity.toFixed(1);
      sensitivity.addEventListener('input', () => {
        const value = Math.min(10, Math.max(1, Number(sensitivity.value) || 1));
        if (sensitivityValue) sensitivityValue.textContent = value.toFixed(1);
        save.setSettings({ sens: value, sensV2: true });
      });
    }

    const qualitySelect = $('quality-select'), qualityValue = $('quality-val'), adaptiveCheck = $('adaptive-check');
    const quality = readSettings(save).quality || 'medium';
    if (qualitySelect) qualitySelect.value = quality;
    if (qualityValue) qualityValue.textContent = quality;
    if (adaptiveCheck) adaptiveCheck.checked = readSettings(save).adaptive !== false;
    qualitySelect?.addEventListener('change', () => {
      const value = qualitySelect.value;
      if (qualityValue) qualityValue.textContent = value;
      save.setSettings({ quality: value });
      render.setQuality(value);
      showToast('Качество графики: ' + value, 'system');
    });
    adaptiveCheck?.addEventListener('change', () => {
      save.setSettings({ adaptive: adaptiveCheck.checked });
      render.setAdaptive(adaptiveCheck.checked);
    });
    const soundCheck = $('game-sound-check'), vibrationCheck = $('game-vibration-check');
    if (soundCheck) soundCheck.checked = readSettings(save).sound !== false;
    if (vibrationCheck) vibrationCheck.checked = readSettings(save).vibration !== false;
    soundCheck?.addEventListener('change', () => { save.setSettings({ sound: soundCheck.checked }); applySound(); });
    vibrationCheck?.addEventListener('change', () => save.setSettings({ vibration: vibrationCheck.checked }));
    render.onAdaptive = message => showToast(message, 'system');

    bindPointerDown($('death-retry'), () => {
      game.loadLevel(level);
      game.start();
      showOverlay('death', false);
    });
    bindPointerDown($('win-next'), () => {
      const nextId = game.config?.story?.next;
      const nextLevel = nextId && byId[nextId];
      if (nextLevel) {
        showOverlay('win', false);
        game.loadLevel(nextLevel);
        game.start();
      } else location.href = './index.html';
    });
    homeButton(document);

    setupTouch(canvas, game.input);
    canvas.addEventListener('pointerdown', event => {
      if (event.pointerType === 'mouse' && document.pointerLockElement !== canvas) {
        try { const result = canvas.requestPointerLock(); result?.catch?.(() => {}); } catch {}
      }
    });
    canvas.addEventListener('pointermove', event => {
      if (event.pointerType === 'mouse' && document.pointerLockElement === canvas) game.input.addLook(event.movementX, event.movementY);
    });
    window.addEventListener('keydown', event => {
      if (event.code === 'Escape') {
        if (noteOpen) closeNote();
        else if (game.paused) game.resume();
        else game.pause();
      }
      game.input.setKey(event.code, true, event.repeat);
    });
    window.addEventListener('keyup', event => game.input.setKey(event.code, false));

    game.events.on('level-loaded', ({ config }) => {
      audio.startAmbient(config?.ambient);
      hud.setStats(game.state());
    });
    game.events.on('pause', () => audio.stopAmbient());
    game.events.on('resume', () => audio.startAmbient(game.config?.ambient));
    game.events.on('interact', () => audio.click());
    game.events.on('step', ({ surface }) => audio.step(surface));
    game.events.on('item-taken', ({ add }) => { audio.take(); showToast(add > 1 ? 'Вода: +' + add : 'Предмет добавлен', 'pickup'); });
    game.events.on('note-taken', ({ lore }) => { audio.note(); showToast('Записка найдена', 'paper'); openNote(lore); });
    game.events.on('door-open', () => { audio.door(); showToast('Дверь открыта', 'door'); });
    game.events.on('noclip-open', () => { audio.noclip(); showToast('Проход открыт', 'door'); });
    game.events.on('win', () => { audio.stopAmbient(); audio.win(); });
    game.events.on('die', () => { audio.stopAmbient(); audio.die(); });

    gestureUnlock(window, () => {
      audio.unlock();
      applySound();
      enterFullscreen(document);
      document.body.classList.remove('ui-open');
      const hint = $('touch-hint');
      if (hint && isTouchDevice()) {
        hint.hidden = false;
        setTimeout(() => { hint.hidden = true; }, 6000);
      }
      game.loadLevel(level);
      game.start();
    });

    initSwUpdate(window, document, 'update-toast');
    window.addEventListener('pagehide', () => {
      game.manualWorld()?.dispose?.();
      audio.dispose?.();
      render.dispose?.();
      touchPointers.clear();
      pressedControls.clear();
    }, { once: true });
    window.__BR_GAME__ = game;
  } catch (error) {
    fatal(document, error);
  }
}

main();
