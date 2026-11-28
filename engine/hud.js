import { fmtTime } from '../core/time.js';

const ITEM_ICONS = {
  water: 'g-water',
  note: 'g-note',
  food: 'g-food',
  spraycan: 'g-spray',
  backpack: 'g-backpack',
  camera: 'g-camera'
};

const ITEM_NAMES = {
  water: 'Вода',
  note: 'Записка',
  food: 'Курица',
  spraycan: 'Баллончик',
  backpack: 'Рюкзак',
  camera: 'Камера'
};

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

  function drawSlot(id, item, active, index) {
    const node = element(id);
    if (!node) return;
    node.classList?.toggle('active', !!active);
    node.classList?.toggle('empty', !item);
    node.dataset.itemType = item ? item.type : '';
    const use = node.querySelector?.('.slot-item-icon use');
    if (use) use.setAttribute('href', '#' + (item ? ITEM_ICONS[item.type] || 'g-slot' : 'g-slot'));
    const count = node.querySelector?.('.slot-count');
    if (count) count.textContent = item ? String(item.count || 1) : '';
    node.setAttribute?.('aria-label', item ? `Слот ${index + 1}: ${ITEM_NAMES[item.type] || 'Предмет'}, ${item.count || 1}` : `Пустой слот ${index + 1}`);
    node.title = item ? ITEM_NAMES[item.type] || 'Предмет' : 'Пустой слот';
  }

  function drawInventory(stats) {
    const inv = stats.inventory || {};
    const slots = Array.isArray(inv.slots) ? inv.slots : [];
    const active = Number.isInteger(inv.activeSlot) ? inv.activeSlot : 0;
    for (let i = 0; i < 3; i++) drawSlot('slot-' + i, slots[i] || null, active === i, i);
    for (let i = 3; i < 12; i++) drawSlot('slot-' + i, slots[i] || null, active === i, i);
    setText('inv-water', inv.water || 0);
    setText('inv-notes', inv.notes || 0);
    setText('arrow-count', stats.arrows || 0);
    const arrowButton = element('draw-arrow-btn');
    if (arrowButton) {
      arrowButton.hidden = !(Number(stats.arrows) > 0);
      arrowButton.disabled = !(Number(stats.arrows) > 0);
    }
    const useButton = element('use-item-btn');
    if (useButton) useButton.hidden = !(slots[active] && slots[active].type === 'food' && Number(stats.stamina) < 100);
    const backpackToggle = element('backpack-toggle');
    if (backpackToggle) {
      backpackToggle.hidden = !inv.hasBackpack;
      backpackToggle.setAttribute?.('aria-pressed', String(!element('backpack-panel')?.hidden));
    }
    if (!inv.hasBackpack) {
      const panel = element('backpack-panel');
      if (panel) panel.hidden = true;
    }
  }

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
      setWidth('bar-sanity', stats.sanity);
      setWidth('bar-stamina', stats.stamina);
      setText('val-sanity', Math.round(stats.sanity) + '%');
      setText('val-stamina', Math.round(stats.stamina) + '%');
      const sanityBar = element('bar-sanity')?.closest?.('.bar');
      const staminaBar = element('bar-stamina')?.closest?.('.bar');
      sanityBar?.classList.toggle('low', stats.sanity < 30);
      staminaBar?.classList.toggle('low', stats.stamina < 25);
      drawInventory(stats);
      pendingStats = null;
    }
  }

  return {
    setLevel(value) { pendingLevel = String(value); flush(false); },
    setTime(value) { pendingTime = value; flush(false); },
    setPrompt(value) { pendingPrompt = value; flush(false); },
    setStats(value) { pendingStats = value; flush(false); },
    setBackpackOpen(visible) {
      const panel = element('backpack-panel');
      const toggle = element('backpack-toggle');
      if (panel) panel.hidden = !visible;
      if (toggle) toggle.setAttribute?.('aria-pressed', String(!!visible));
    },
    showLayer(id, visible) { const node = element(id); if (node) node.hidden = !visible; },
    flush: () => flush(true)
  };
}
