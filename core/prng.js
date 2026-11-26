// Детерминированный PRNG (mulberry-класс) + хеш сидов. Одинаковый сид = одинаковая последовательность (ТЗ 4.3).
export function hashStr(s) {
  let h = 2166136261 >>> 0;
  s = String(s);
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
export function prng(seed) {
  let a = (typeof seed === 'number' ? seed : hashStr(seed)) >>> 0;
  const next = () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int: n => Math.floor(next() * n),
    range: (lo, hi) => lo + next() * (hi - lo),
    pick: arr => arr[Math.floor(next() * arr.length)],
    chance: p => next() < p
  };
}
// Сид забега: база + метка времени входа (анти-память 5.10). Doctor передаёт фиксированную метку (9.19).
export function runSeed(baseSeed, timeLabel) {
  return hashStr(String(baseSeed) + '|' + String(timeLabel === undefined ? Date.now() : timeLabel));
}
