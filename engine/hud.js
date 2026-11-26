import { fmtTime } from '../core/time.js';

// HUD-мост: числа состояния -> DOM не чаще interval мс (4.4). Часы инжектятся для headless-теста.
export function createHud(doc, opts = {}) {
  const interval = opts.interval ?? 100;
  const now = opts.now || (() => Date.now());
  let last = -Infinity;
  let pendingLevel = undefined, pendingTime = null, pendingPrompt = undefined;
  const el = id => doc.getElementById(id);
  function flush(force) {
    const t = now();
    if (!force && t - last < interval) return;
    last = t;
    if (pendingLevel !== undefined) { const e = el('hud-level'); if (e) e.textContent = pendingLevel; pendingLevel = undefined; }
    if (pendingTime !== null) { const e = el('hud-time'); if (e) e.textContent = fmtTime(pendingTime); pendingTime = null; }
    if (pendingPrompt !== undefined) { const e = el('hud-prompt'); const pb = el('prompt'); if (e) e.textContent = pendingPrompt || '—'; if (pb) pb.hidden = !pendingPrompt; pendingPrompt = undefined; }
  }
  return {
    setLevel(v) { pendingLevel = String(v); flush(false); },
    setTime(t) { pendingTime = t; flush(false); },
    setPrompt(v) { pendingPrompt = v; flush(false); },
    showLayer(id, show) { const e = el(id); if (e) e.hidden = !show; },
    flush: () => flush(true)
  };
}
