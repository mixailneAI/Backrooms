import { clamp } from './math.js';
export function hexToRgb(hex) {
  let h = String(hex).replace('#', '');
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  const n = parseInt(h, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}
export const rgbToHex = (r, g, b) => '#' + [r, g, b].map(v => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join('');
// f > 0 — осветление к белому, f < 0 — затемнение к чёрному. Для биом-вариаций (ТЗ 4.3).
export function shade(hex, f) {
  const c = hexToRgb(hex);
  return f >= 0 ? rgbToHex(c.r + (255 - c.r) * f, c.g + (255 - c.g) * f, c.b + (255 - c.b) * f)
                : rgbToHex(c.r * (1 + f), c.g * (1 + f), c.b * (1 + f));
}
