// Реестр уровней (4.9). Порядок = порядок карточек. byId для engine/doctor.
// Global-реестры избегают circular-импортов engine↔levels (3.4). Пока пуст: уровни добавляются конфигами после рантайма.
export const levels = [];
export const byId = {};
export const abyss = { id: 'abyss', name: 'Бездна', chunked: true, danger: '∞', tags: 'бесконечность, стихии глубины, без финала' };
globalThis.__BR_LEVELS__ = levels;
globalThis.__BR_BYID__ = byId;
