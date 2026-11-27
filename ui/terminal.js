import { levels as registryLevels, abyss } from '../levels/all.js';
import { createSave } from '../engine/save.js';
import { initSwUpdate } from './sw-update.js';
const $ = (doc, id) => doc.getElementById(id);
function card(doc, level, locked) {
  const el = doc.createElement('article');
  el.className = 'card' + (locked ? ' locked' : '');
  const num = doc.createElement('span'); num.className = 'card-num'; num.textContent = String(level.number ?? level.id);
  const name = doc.createElement('h3'); name.textContent = level.name || level.id;
  const danger = doc.createElement('span'); danger.className = 'card-danger'; danger.textContent = 'класс ' + (level.danger ?? '?');
  const tags = doc.createElement('p'); tags.className = 'card-tags'; tags.textContent = level.tags || '';
  const state = doc.createElement('span'); state.className = 'card-state'; state.textContent = locked ? 'заблокирован' : 'открыт';
  el.appendChild(num); el.appendChild(name); el.appendChild(danger); el.appendChild(tags); el.appendChild(state);
  el._state = state;
  return el;
}
function startBackground(win, doc) {
  if (!win.requestAnimationFrame || !doc.createElement) return;
  const cv = doc.getElementById('bg');
  if (!cv || !cv.getContext) return;
  import('../vendor/three.module.js').then(THREE => import('../world/manual.js').then(M => {
    const renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: false });
    renderer.setPixelRatio(Math.min(win.devicePixelRatio || 1, 1.5));
    renderer.setSize(win.innerWidth, win.innerHeight, false);
    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog('#2f2812', 6, 42);
    renderer.setClearColor('#2f2812', 1);
    const cam = new THREE.PerspectiveCamera(70, win.innerWidth / win.innerHeight, 0.1, 100);
    cam.rotation.order = 'YXZ';
    scene.add(new THREE.HemisphereLight('#d7c87d', '#6f6030', 0.9));
    const w = M.createManualWorld(THREE, scene, { bounds: { w: 40, d: 40 }, palette: { wall: { base: '#c7b65a', dark: '#8e7a32', light: '#ded08a' }, floor: { base: '#8a7a3a', dark: '#5f5428', light: '#b3a46a' }, ceiling: { base: '#b7a98a', dark: '#665d49', light: '#d6cdb4' } } });
    w.perimeter({ w: 40, d: 40 });
    w.floor({ x: 0, z: 0, w: 40, d: 40, type: 'carpet' });
    w.ceiling({ x: 0, z: 0, w: 40, d: 40, type: 'ceiling' });
    for (let i = -3; i <= 3; i++) { w.box({ x: i * 5, z: -6, w: 0.4, d: 10 }); w.box({ x: i * 5 + 2.5, z: 6, w: 0.4, d: 10 }); w.lightPanel({ x: i * 5, z: 0 }); }
    w.flush();
    cam.position.set(0, 1.6, 0);
    let t = 0;
    const loop = () => { t += 0.0035; cam.rotation.y = Math.sin(t) * 0.6; cam.position.z = Math.sin(t * 0.7) * 3; renderer.render(scene, cam); win.requestAnimationFrame(loop); };
    loop();
  })).catch(() => {});
}
export function initTerminal(doc = document, win = globalThis, opts = {}) {
  try { if (doc.fullscreenElement && doc.exitFullscreen) { const p = doc.exitFullscreen(); if (p && p.catch) p.catch(() => {}); } } catch (e) {}
  const levels = opts.levels ?? registryLevels;
  const save = opts.save ?? createSave();
  const progress = save.progress();
  const unlocked = id => progress.unlocked.includes(id);
  const set = (id, v) => { const el = $(doc, id); if (el) el.textContent = String(v); };
  const noteCount = Object.values(progress.notes).reduce((n, a) => n + a.length, 0);
  set('level-count', levels.length);
  set('stats-unlocked', levels.filter(l => unlocked(l.id)).length);
  set('stats-notes', noteCount);
  set('stats-deaths', progress.deaths);
  const grid = $(doc, 'level-grid');
  const enter = $(doc, 'enter-btn');
  let selectedId = null;
  function refreshEnter() {
    if (!enter) return;
    const sel = levels.find(l => l.id === selectedId);
    if (!levels.length) { enter.textContent = 'НЕТ УРОВНЕЙ'; enter.disabled = true; return; }
    enter.disabled = !sel;
    enter.textContent = sel ? 'НАЧАТЬ: ' + (sel.name || sel.id) : 'ВЫБЕРИ УРОВЕНЬ';
  }
  for (const l of levels) {
    const locked = !unlocked(l.id) && l.number !== 0;
    const el = card(doc, l, locked);
    if (!locked) el.addEventListener('click', () => {
      selectedId = l.id;
      for (const c of grid.children) {
        if (c.classList) c.classList.remove('selected');
        if (c._state) c._state.textContent = c.className.includes('locked') ? 'заблокирован' : 'открыт';
      }
      el.classList.add('selected');
      if (el._state) el._state.textContent = 'выбрана';
      refreshEnter();
    });
    else el.addEventListener('click', () => { const t = $(doc, 'update-toast'); if (t) { t.textContent = 'Уровень заблокирован: пройди предыдущий'; t.hidden = false; } });
    grid.appendChild(el);
  }
  if (!levels.length) { const empty = doc.createElement('p'); empty.className = 'empty'; empty.textContent = 'Уровни ещё не собраны.'; grid.appendChild(empty); }
  if (enter) enter.addEventListener('click', () => { if (selectedId) win.location.href = './game.html?id=' + encodeURIComponent(selectedId); });
  refreshEnter();
  const show = (id, on) => { const el = $(doc, id); if (el) el.hidden = !on; };
  const playBtn = $(doc, 'play-btn'), setBtn = $(doc, 'settings-btn');
  const inPanel = on => { if (doc.body && doc.body.classList) doc.body.classList.toggle('in-panel', on); };
  if (playBtn) playBtn.addEventListener('click', () => { show('level-panel', true); show('menu', false); inPanel(true); });
  if (setBtn) setBtn.addEventListener('click', () => { show('settings-panel', true); show('menu', false); inPanel(true); });
  const b1 = $(doc, 'level-back'), b2 = $(doc, 'settings-back');
  if (b1) b1.addEventListener('click', () => { show('level-panel', false); show('menu', true); inPanel(false); });
  if (b2) b2.addEventListener('click', () => { show('settings-panel', false); show('menu', true); inPanel(false); });
  const range = $(doc, 'sens-range'), sval = $(doc, 'sens-val');
  const s0 = (save.settings && save.settings()) || {};
  const sens = Math.min(10, Math.max(1, Number(s0.sens) || 1));
  if (range) { range.value = String(sens); if (sval) sval.textContent = sens.toFixed(2); }
  if (range) range.addEventListener('input', () => { const v = Math.min(10, Math.max(1, Number(range.value))); if (sval) sval.textContent = v.toFixed(2); save.setSettings({ sens: v, sensV2: true }); });
  const qsel = $(doc, 'quality-select');
  if (qsel) { qsel.value = s0.quality || 'medium'; qsel.addEventListener('change', () => save.setSettings({ quality: qsel.value })); }
  const vib = $(doc, 'vibration-check'), snd = $(doc, 'sound-check');
  if (vib) { vib.checked = s0.vibration !== false; vib.addEventListener('change', () => save.setSettings({ vibration: vib.checked })); }
  if (snd) { snd.checked = s0.sound !== false; snd.addEventListener('change', () => save.setSettings({ sound: snd.checked })); }
  let deferred = null;
  const install = $(doc, 'install-btn');
  win.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferred = e; });
  if (install) install.addEventListener('click', () => {
    if (deferred) deferred.prompt();
    else { const t = $(doc, 'update-toast'); if (t) { t.textContent = 'Меню браузера → Добавить на главный экран'; t.hidden = false; } }
  });
  const abyssEl = $(doc, 'abyss-card');
  if (abyssEl) abyssEl.addEventListener('click', () => { win.location.href = './game.html?id=' + abyss.id; });
  const exitBtn = $(doc, 'exit-btn');
  if (exitBtn) exitBtn.addEventListener('click', () => { try { win.close(); } catch (e) {} const t = $(doc, 'update-toast'); if (t) { t.textContent = 'Закрой вкладку браузера, чтобы выйти'; t.hidden = false; } });
  initSwUpdate(win, doc, 'update-toast');
  const goWide = () => {
    try {
      const el = doc.documentElement;
      const req = el.requestFullscreen || el.webkitRequestFullscreen || el.msRequestFullscreen;
      if (req) { const p = req.call(el); if (p && p.catch) p.catch(() => {}); }
    } catch (e) {}
    try { if (win.screen && win.screen.orientation && win.screen.orientation.lock) win.screen.orientation.lock('landscape').catch(() => {}); } catch (e) {}
  };
  win.addEventListener('pointerdown', goWide, { once: true });
  startBackground(win, doc);
  return { levels, save };
}
if (typeof document !== 'undefined' && document.getElementById && document.getElementById('level-grid')) initTerminal();
