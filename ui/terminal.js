import { levels as registryLevels, abyss } from '../levels/all.js';
import { createSave } from '../engine/save.js';

const $ = (doc, id) => doc.getElementById(id);

function card(doc, win, level, locked) {
  const el = doc.createElement('article');
  el.className = 'card' + (locked ? ' locked' : '');
  const num = doc.createElement('span'); num.className = 'card-num'; num.textContent = String(level.number ?? level.id);
  const name = doc.createElement('h3'); name.textContent = level.name || level.id;
  const danger = doc.createElement('span'); danger.className = 'card-danger'; danger.textContent = 'класс ' + (level.danger ?? '?');
  const tags = doc.createElement('p'); tags.className = 'card-tags'; tags.textContent = level.tags || '';
  const state = doc.createElement('span'); state.className = 'card-state'; state.textContent = locked ? 'заблокирован' : 'открыт';
  el.appendChild(num); el.appendChild(name); el.appendChild(danger); el.appendChild(tags); el.appendChild(state);
  if (!locked) el.addEventListener('click', () => { win.location.href = './game.html?id=' + encodeURIComponent(level.id); });
  return el;
}

export function initTerminal(doc = document, win = globalThis, opts = {}) {
  const levels = opts.levels ?? registryLevels;
  const save = opts.save ?? createSave();
  const progress = save.progress();
  const unlocked = id => progress.unlocked.includes(id);
  const set = (id, v) => { const el = $(doc, id); if (el) el.textContent = String(v); };
  const noteCount = Object.values(progress.notes).reduce((n, arr) => n + arr.length, 0);
  set('level-count', levels.length);
  set('stats-unlocked', levels.filter(l => unlocked(l.id)).length);
  set('stats-notes', noteCount);
  set('stats-deaths', progress.deaths);
  const grid = $(doc, 'level-grid');
  for (const l of levels) grid.appendChild(card(doc, win, l, !unlocked(l.id) && l.number !== 0));
  if (!levels.length) {
    const empty = doc.createElement('p');
    empty.className = 'empty';
    empty.textContent = 'Уровни ещё не собраны. Следующий блок M1 добавит рантайм и Лобби.';
    grid.appendChild(empty);
  }
  const enter = $(doc, 'enter-btn');
  const first = levels[0];
  if (enter) {
    if (first) {
      enter.textContent = 'Войти в ' + (first.name || first.id);
      enter.addEventListener('click', () => { win.location.href = './game.html?id=' + encodeURIComponent(first.id); });
    } else { enter.textContent = 'Вход скоро'; enter.disabled = true; }
  }
  const abyssEl = $(doc, 'abyss-card');
  if (abyssEl) abyssEl.addEventListener('click', () => { win.location.href = './game.html?id=' + abyss.id; });
  let deferred = null;
  const install = $(doc, 'install-btn');
  win.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferred = e; if (install) install.hidden = false; });
  if (install) install.addEventListener('click', () => { if (deferred) deferred.prompt(); });
  const nav = win.navigator;
  if (nav && nav.serviceWorker) {
    nav.serviceWorker.register('./sw.js').then(reg => {
      reg.addEventListener('updatefound', () => {
        const sw = reg.installing;
        if (!sw) return;
        sw.addEventListener('statechange', () => {
          if (sw.state === 'installed' && nav.serviceWorker.controller) {
            const toast = $(doc, 'update-toast');
            if (toast) { toast.hidden = false; toast.addEventListener('click', () => { sw.postMessage('SKIP_WAITING'); win.location.reload(); }); }
          }
        });
      });
    }).catch(() => {});
  }
  return { levels, save };
}
if (typeof document !== 'undefined' && document.getElementById && document.getElementById('level-grid')) initTerminal();
