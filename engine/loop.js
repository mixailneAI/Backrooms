import { clamp } from '../core/math.js';

export const MAX_DT = 1 / 20; // защита от скачка дельты при возврате из фона (4.4)
// rAF-цикл: только расписание и clamp. Порядок фаз кадра — в game.tick (делегат состояния с первого дня).
export function createLoop(game, hooks = {}) {
  const raf = hooks.raf || (typeof requestAnimationFrame !== 'undefined' ? requestAnimationFrame : null);
  const caf = hooks.caf || (typeof cancelAnimationFrame !== 'undefined' ? cancelAnimationFrame : null);
  const now = hooks.now || (() => performance.now());
  let id = 0, last = 0, running = false;
  const frame = t => {
    if (!running) return;
    const dt = clamp((t - last) / 1000, 0, MAX_DT);
    last = t;
    game.tick(dt);
    id = raf(frame);
  };
  return {
    start() { if (running || !raf) return; running = true; last = now(); id = raf(frame); },
    stop() { running = false; if (id && caf) caf(id); id = 0; },
    running: () => running
  };
}
