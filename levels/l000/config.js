import { build } from './build.js';
export const level = {
  id: 'l0', number: 0, name: 'Лобби', title: 'Уровень 0', danger: '0',
  storyBranch: true, chunked: false, manualFallback: true, seed: 20261126,
  tags: 'ковёр, гул ламп, жёлтые стены',
  desc: 'Ты вошёл сюда не там, где надо. Гул ламп и мокрый ковёр под ногами.',
  hint: 'Иди к зелёной раме — это выход.', goal: 'Найди выход из Лобби',
  toast: 'Лобби. Тишина обманчива.',
  ambient: 'hum',
  sanityDrain: 0.2, stepSurface: 'carpet',
  lore: [{ title: 'Записка 0', text: 'Если гул стал громче — не оборачивайся. Просто иди на свет.' }],
  biome: {
    name: 'lobby', wallDensity: 0.28, height: 3,
    palette: { wall: '#b8a24a', floor: '#8a7a3a', ceiling: '#c9bd7a' },
    fog: { color: '#2a2410', near: 12, far: 70 },
    hemi: 0.8, ambientLight: 0.30, dirLight: 0.28,
    ambient: 'hum', entityType: 'none', entitySpeed: 0,
    openSky: false, water: false, bounds: { w: 24, d: 24 }
  },
  story: { next: null, final: true, water: 1 },
  build
};
