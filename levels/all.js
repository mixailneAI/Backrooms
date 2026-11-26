import { level as l0 } from './l000/config.js';
// Реестр уровней (4.9). Порядок = карточки терминала. byId для engine/doctor.
export const levels = [l0];
export const byId = { l0 };
export const abyss = { id: 'abyss', name: 'Бездна', chunked: true, danger: '∞', tags: 'бесконечность, стихии глубины, без финала' };
globalThis.__BR_LEVELS__ = levels;
globalThis.__BR_BYID__ = byId;
