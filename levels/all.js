import { level as l0 } from './l000/config.js';
// Реестр уровней (4.9). Порядок = карточки терминала. byId для engine/doctor.
export const levels = [l0];
export const abyss = {
  id: 'abyss', name: 'Бездна', chunked: true, danger: 'MAX',
  tags: 'бесконечность, стихии глубины, без финала',
  seed: 913, sanityDrain: 0.35, ambient: 'deep', stepSurface: 'carpet',
  story: null, lore: [],
  biome: {
    name: 'abyss', height: 3, wallDensity: 0.24,
    palette: { wall: '#b8a24a', floor: '#6f6030', ceiling: '#a89877' },
    fog: { color: '#1c1608', near: 8, far: 40 },
    hemi: 0.8, ambientLight: 0.26, ambient: 'deep',
    entityType: 'none', entitySpeed: 0, openSky: false, water: false
  }
};
export const byId = { l0, abyss };
globalThis.__BR_LEVELS__ = levels;
globalThis.__BR_BYID__ = byId;
