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
const LOOK_SCALE = 0.55;
const touchPointers = new Map();
function isTouchDevice() { return 'ontouchstart' in window || (navigator.maxTouchPoints || 0) > 0; }
function vibrate(save) { try { if (save.settings().vibration && navigator.vibrate) navigator.vibrate(15); } catch (e) {} }
function enterFullscreen(doc) {
  try {
    const el = doc.documentElement;
    const req = el.requestFullscreen || el.webkitRequestFullscreen || el.msRequestFullscreen;
    if (!req) return;
    try {
      const p = req.call(el, { navigationUI: 'hide' });
      if (p && typeof p.catch === 'function') p.catch(() => { try { const p2 = req.call(el); if (p2 && p2.catch) p2.catch(() => {}); } catch (e2) {} });
    } catch (e) {
      try { req.call(el); } catch (e2) {}
    }
  } catch (e) {}
}
function setJoyOrigin(x, y) {
  const joy = $('joystick');
  if (joy) { joy.style.left = (x - 63) + 'px'; joy.style.top = (y - 63) + 'px'; joy.hidden = false; }
}
function setKnob(dx, dy) {
  const knob = $('joy-knob');
  if (knob) knob.style.transform = 'translate(' + dx + 'px,' + dy + 'px)';
}
function hideJoy() {
  const joy = $('joystick');
  const knob = $('joy-knob');
  if (joy) joy.hidden = true;
  if (knob) knob.style.transform = 'translate(0px,0px)';
}
function setupTouch(canvas, input) {
  const half = () => window.innerWidth / 2;
  canvas.addEventListener('pointerdown', e => {
    if (e.pointerType !== 'touch') return;
    e.preventDefault();
    const left = e.clientX < half();
    touchPointers.set(e.pointerId, { left, x: e.clientX, y: e.clientY, ox: e.clientX, oy: e.clientY });
    if (left) { setJoyOrigin(e.clientX, e.clientY); input.setJoystick(0, 0); }
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
        const cx = (dx / len) * Math.min(len, JOY_RADIUS);
        const cy = (dy / len) * Math.min(len, JOY_RADIUS);
        setKnob(cx, cy);
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
    if (p && p.left) { input.setJoystick(0, 0); hideJoy(); }
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
    const audio = createAudio();
    let noteOpen = false;
    let toastTimer = 0;
    let sprintHeld = false;
    const showOverlay = (id, show) => { const el = $(id); if (el) el.hidden = !show; };
    const game = createGame({
      render, save, hud, THREE,
      worldModule: await import('../world/manual.js'),
      onState(state, detail) {
        showOverlay('pause', state === 'pause' && !noteOpen);
        showOverlay('death', state === 'death');
        showOverlay('win', state === 'win');
        if (state === 'play') showOverlay('settings', false);
        if (state === 'death') { const c = $('death-cause'); if (c) c.textContent = (detail && detail.cause) || ''; }
        document.body.classList.toggle('ui-open', state !== 'play' || noteOpen);
      }
    });
    document.body.classList.add('ui-open');
    function showToast(text) {
      const t = $('toast');
      if (!t) return;
      t.textContent = text;
      t.hidden = false;
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => { t.hidden = true; }, 2200);
    }
    function openNote(lore) {
      noteOpen = true;
      const title = lore && lore.title ? lore.title : 'Записка';
      const text = lore && lore.text ? lore.text : 'Текст потерян. Гул лампы отвечает не сразу.';
      const nt = $('note-title'), nx = $('note-text');
      if (nt) nt.textContent = title;
      if (nx) nx.textContent = text;
      showOverlay('note', true);
      game.pause();
    }
    function closeNote() {
      noteOpen = false;
      showOverlay('note', false);
      if (game.paused) game.resume();
    }
    $('pause-resume').addEventListener('click', () => { vibrate(save); enterFullscreen(document); showOverlay('settings', false); game.resume(); });
    $('pause-settings').addEventListener('click', () => { vibrate(save); showOverlay('pause', false); showOverlay('settings', true); });
    $('settings-close').addEventListener('click', () => { vibrate(save); showOverlay('settings', false); showOverlay('pause', true); });
    $('pause-fullscreen').addEventListener('click', () => { vibrate(save); enterFullscreen(document); });
    $('pause-btn').addEventListener('click', () => { vibrate(save); game.pause(); });
    $('prompt').addEventListener('click', () => { vibrate(save); const ok = game.interact(); if (!ok) showToast('Ничего рядом'); });
    $('note-close').addEventListener('click', () => { vibrate(save); closeNote(); });
    const sprintBtn = $('sprint-btn');
    function setSprintHeld(v) {
      sprintHeld = !!v;
      game.setSprint(v);
      if (sprintBtn) sprintBtn.classList.toggle('active', sprintHeld);
    }
    if (sprintBtn) {
      sprintBtn.addEventListener('pointerdown', e => { e.preventDefault(); vibrate(save); setSprintHeld(true); });
      sprintBtn.addEventListener('pointerup', () => setSprintHeld(false));
      sprintBtn.addEventListener('pointercancel', () => setSprintHeld(false));
      sprintBtn.addEventListener('pointerleave', () => setSprintHeld(false));
    }
    window.addEventListener('pointerup', () => { if (sprintHeld) setSprintHeld(false); });
    const range = $('sens-range'), val = $('sens-val');
    const sens = Number((save.settings().sens) || 1);
    if (range) {
      range.value = String(Math.min(3, Math.max(0.3, sens)));
      if (val) val.textContent = Number(range.value).toFixed(2);
    }
    if (range) range.addEventListener('input', () => {
      const v = Math.min(3, Math.max(0.3, Number(range.value)));
      if (val) val.textContent = v.toFixed(2);
      save.setSettings({ sens: v });
    });
    $('death-retry').addEventListener('click', () => { game.loadLevel(level); game.start(); showOverlay('death', false); });
    $('win-next').addEventListener('click', () => {
      const next = game.config && game.config.story && game.config.story.next;
      const nextLevel = next && byId[next];
      if (nextLevel) { showOverlay('win', false); game.loadLevel(nextLevel); game.start(); }
      else location.href = './index.html';
    });
    homeButton(document);
    setupTouch(canvas, game.input);
    canvas.addEventListener('pointerdown', e => {
      if (e.pointerType === 'mouse' && document.pointerLockElement !== canvas) {
        try { const p = canvas.requestPointerLock(); if (p && typeof p.catch === 'function') p.catch(() => {}); } catch (err) {}
      }
    });
    canvas.addEventListener('pointermove', e => {
      if (e.pointerType === 'mouse' && document.pointerLockElement === canvas) game.input.addLook(e.movementX, e.movementY);
    });
    window.addEventListener('keydown', e => {
      if (e.code === 'Escape') { if (noteOpen) closeNote(); else if (game.paused) game.resume(); else game.pause(); }
      game.input.setKey(e.code, true, e.repeat);
    });
    window.addEventListener('keyup', e => game.input.setKey(e.code, false));
    game.events.on('level-loaded', ({ config }) => { audio.startAmbient(config && config.ambient); hud.setStats(game.state()); });
    game.events.on('pause', () => audio.stopAmbient());
    game.events.on('resume', () => audio.startAmbient(game.config && game.config.ambient));
    game.events.on('step', ({ surface }) => audio.step(surface));
    game.events.on('item-taken', ({ item, add }) => { audio.take(); showToast(add > 1 ? 'Вода +' + add : 'Предмет взят'); });
    game.events.on('note-taken', ({ lore }) => { audio.note(); openNote(lore); });
    game.events.on('door-open', () => { audio.door(); showToast('Дверь открыта'); });
    game.events.on('noclip-open', () => { audio.noclip(); showToast('Проход открыт'); });
    game.events.on('win', () => { audio.stopAmbient(); audio.win(); });
    game.events.on('die', () => { audio.stopAmbient(); audio.die(); });
    gestureUnlock(window, () => {
      audio.unlock();
      audio.setVolume(save.settings().sound === false ? 0 : 0.35);
      enterFullscreen(document);
      document.body.classList.remove('ui-open');
      const hint = $('touch-hint');
      if (hint && isTouchDevice()) { hint.hidden = false; setTimeout(() => { hint.hidden = true; }, 6000); }
      game.loadLevel(level);
      game.start();
    });
    initSwUpdate(window, document, 'update-toast');
    window.__BR_GAME__ = game;
  } catch (e) { fatal(document, e); }
}
main();
