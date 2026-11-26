import { build } from './build.js';
export const level = {
  id: 'l0', number: 0, name: 'Лобби', title: 'Уровень 0', danger: '0',
  storyBranch: true, chunked: false, manualFallback: true, seed: 20261126,
  tags: 'ковёр, гул ламп, жёлтые стены',
  desc: 'Ты вошёл сюда не там, где надо. Гул ламп и мокрый ковёр под ногами.',
  hint: 'Иди к зелёной раме — это выход.', goal: 'Найди выход из Лобби',
  toast: 'Лобби. Тишина обманчива.',
  ambient: 'hum',
  sanityDrain: 0.12, stepSurface: 'carpet',
  lore: [{ title: 'Записка 0', text: 'Если гул стал громче — не оборачивайся. Просто иди на свет.' }],
  biome: {
    name: 'lobby', wallDensity: 0.28, height: 3,
    palette: {
      wall: { base: '#c7b65a', dark: '#8e7a32', light: '#ded08a' },
      floor: { base: '#8a7a3a', dark: '#5f5428', light: '#b3a46a' },
      ceiling: { base: '#b7a98a', dark: '#665d49', light: '#d6cdb4' }
    },
    fog: { color: '#2f2812', near: 13, far: 78 },
    hemi: 0.95, ambientLight: 0.38, dirLight: 0.34,
    ambient: 'hum', entityType: 'none', entitySpeed: 0,
    openSky: false, water: false, bounds: { w: 24, d: 24 }
  },
  story: { next: null, final: true, water: 1 },
  build
};
