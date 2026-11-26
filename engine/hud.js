import { fmtTime } from '../core/time.js';
export function createHud(doc, opts = {}) {
  const interval = opts.interval ?? 100;
  const now = opts.now || (() => Date.now());
  let last = -Infinity;
  let pendingLevel = undefined, pendingTime = null, pendingPrompt = undefined, pendingStats = null;
  const el = id => doc.getElementById(id);
  function setText(id, v) { const e = el(id); if (e) e.textContent = String(v); }
  function setWidth(id, pct) { const e = el(id); if (e) e.style.width = Math.max(0, Math.min(100, pct)) + '%'; }
  function flush(force) {
    const t = now();
    if (!force && t - last < interval) return;
    last = t;
    if (pendingLevel !== undefined) { setText('hud-level', pendingLevel); pendingLevel = undefined; }
    if (pendingTime !== null) { setText('hud-time', fmtTime(pendingTime)); pendingTime = null; }
    if (pendingPrompt !== undefined) { setText('hud-prompt', pendingPrompt || '—'); const pb = el('prompt'); if (pb) pb.hidden = !pendingPrompt; pendingPrompt = undefined; }
    if (pendingStats) {
      const s = pendingStats;
      const inv = s.inventory || {};
      setWidth('bar-sanity', s.sanity);
      setWidth('bar-stamina', s.stamina);
      setText('val-sanity', Math.round(s.sanity) + '%');
      setText('val-stamina', Math.round(s.stamina) + '%');
      setText('inv-water', inv.water || 0);
      setText('inv-notes', inv.notes || 0);
      pendingStats = null;
    }
  }
  return {
    setLevel(v) { pendingLevel = String(v); flush(false); },
    setTime(t) { pendingTime = t; flush(false); },
    setPrompt(v) { pendingPrompt = v; flush(false); },
    setStats(s) { pendingStats = s; flush(false); },
    showLayer(id, show) { const e = el(id); if (e) e.hidden = !show; },
    flush: () => flush(true)
  };
}
