import { dist2 } from '../core/math.js';

// Ближайший взаимодействуемый в радиусе + контекст кнопки E (4.4, 5.8).
const LABELS = { exit: 'Выйти', note: 'Читать', item: 'Взять', door: 'Открыть', noclip: 'Пройти' };
export function createInteract(opts = {}) {
  const radius = opts.radius ?? 2.2;
  let items = [];
  const nearest = (x, z) => {
    let best = null, bd = radius;
    for (const it of items) {
      if (it.taken) continue;
      const d = dist2(x, z, it.x || 0, it.z || 0);
      if (d <= bd) { bd = d; best = it; }
    }
    return best;
  };
  return {
    setItems(list) { items = list || []; },
    nearest,
    context(x, z) {
      const it = nearest(x, z);
      return it ? { id: it.id, type: it.type, label: it.label || LABELS[it.type] || 'E' } : null;
    }
  };
}
