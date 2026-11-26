// Boot: читает ?id=, показывает фатал, вызывает жест разблокировки звука (4.12), создаёт game (4.4).
// Импорты уровней идут из levels/all.js (глобальный реестр, 4.9).
export function parseId(search) {
  const m = /[?&]id=([^&]+)/.exec(search || '');
  return m ? decodeURIComponent(m[1]) : null;
}
export function fatal(doc, err) {
  const el = doc.getElementById('fatal');
  const st = doc.getElementById('fatal-stack');
  if (el) el.hidden = false;
  if (st) st.textContent = (err && err.stack) || String(err);
}
export function gestureUnlock(win, cb) {
  const unlock = () => {
    win.removeEventListener('pointerdown', unlock);
    win.removeEventListener('keydown', unlock);
    if (typeof cb === 'function') cb();
  };
  win.addEventListener('pointerdown', unlock, { once: true });
  win.addEventListener('keydown', unlock, { once: true });
}
export function homeButton(doc, url = './index.html') {
  ['fatal-home', 'pause-home', 'death-home', 'win-home'].forEach(id => {
    const b = doc.getElementById(id);
    if (b) b.addEventListener('click', () => { doc.defaultView.location.href = url; });
  });
}
