import { fmtTime } from '../core/time.js';

export function createHud(doc, opts = {}) {
  const interval = opts.interval ?? 90;
  const now = opts.now || (() => Date.now());
  let last = -Infinity;
  let pendingLevel;
  let pendingTime = null;
  let pendingPrompt;
  let pendingStats = null;
  const element = id => doc.getElementById(id);
  const setText = (id, value) => { const node = element(id); if (node) node.textContent = String(value); };
  const setWidth = (id, value) => {
    const node = element(id);
    if (node) node.style.width = Math.max(0, Math.min(100, Number(value) || 0)) + '%';
  };

  function flush(force = false) {
    const time = now();
    if (!force && time - last < interval) return;
    last = time;
    if (pendingLevel !== undefined) { setText('hud-level', pendingLevel); pendingLevel = undefined; }
    if (pendingTime !== null) { setText('hud-time', fmtTime(pendingTime)); pendingTime = null; }
    if (pendingPrompt !== undefined) {
      setText('hud-prompt', pendingPrompt || '—');
      const button = element('prompt');
      if (button) button.hidden = !pendingPrompt;
      const label = element('prompt-label');
      if (label) label.textContent = pendingPrompt || 'E';
      pendingPrompt = undefined;
    }
    if (pendingStats) {
      const stats = pendingStats;
      const inventory = stats.inventory || {};
      setWidth('bar-sanity', stats.sanity);
      setWidth('bar-stamina', stats.stamina);
      setText('val-sanity', Math.round(stats.sanity) + '%');
      setText('val-stamina', Math.round(stats.stamina) + '%');
      setText('inv-water', inventory.water || 0);
      setText('inv-notes', inventory.notes || 0);
      const sanityBar = element('bar-sanity')?.closest?.('.bar');
      const staminaBar = element('bar-stamina')?.closest?.('.bar');
      sanityBar?.classList.toggle('low', stats.sanity < 30);
      staminaBar?.classList.toggle('low', stats.stamina < 25);
      pendingStats = null;
    }
  }

  return {
    setLevel(value) { pendingLevel = String(value); flush(false); },
    setTime(value) { pendingTime = value; flush(false); },
    setPrompt(value) { pendingPrompt = value; flush(false); },
    setStats(value) { pendingStats = value; flush(false); },
    showLayer(id, visible) { const node = element(id); if (node) node.hidden = !visible; },
    flush: () => flush(true)
  };
}
