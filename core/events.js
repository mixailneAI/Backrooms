// Минимальная шина: подписка/отписка/emit с защитой от исключения в обработчике (ТЗ 4.3).
export function bus() {
  const m = new Map();
  const off = (ev, fn) => { const s = m.get(ev); if (s) s.delete(fn); };
  const on = (ev, fn) => { if (!m.has(ev)) m.set(ev, new Set()); m.get(ev).add(fn); return () => off(ev, fn); };
  const emit = (ev, payload) => {
    const s = m.get(ev);
    if (!s) return;
    for (const fn of [...s]) { try { fn(payload); } catch (e) { console.error('[events]', ev, e); } }
  };
  return { on, off, emit };
}
