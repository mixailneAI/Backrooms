export function build(w, seed, pal) {
  const p = pal || {};
  const wallPal = p.wall || {};
  const floorPal = p.floor || {};
  const ceilPal = p.ceiling || {};
  w.perimeter({ w: 24, d: 24, palette: wallPal });
  w.floor({ x: 0, z: 0, w: 24, d: 24, type: 'carpet', palette: floorPal });
  w.ceiling({ x: 0, z: 0, w: 24, d: 24, type: 'ceiling', palette: ceilPal });
  w.lightPanel({ x: -6, z: -8 }); w.lightPanel({ x: 6, z: -8 });
  w.lightPanel({ x: -6, z: 0 }); w.lightPanel({ x: 6, z: 0 });
  w.lightPanel({ x: -6, z: 8 }); w.lightPanel({ x: 6, z: 8 });
  w.box({ x: -6, z: -4, w: 8, d: 0.5, palette: wallPal });
  w.box({ x: 6, z: -4, w: 8, d: 0.5, palette: wallPal });
  w.box({ x: -6, z: 4, w: 8, d: 0.5, palette: wallPal });
  w.box({ x: 6, z: 4, w: 8, d: 0.5, palette: wallPal });
  w.box({ x: 0, z: -8, w: 0.5, d: 8, palette: wallPal });
  w.box({ x: 0, z: 8, w: 0.5, d: 8, palette: wallPal });
  w.spawn({ x: -9, z: -9 });
  w.exit({ id: 'exit0', x: 9, z: 9, data: { kind: 'frame' } });
  w.item({ id: 'water0', x: -5, z: 0, color: '#bfefff', data: { kind: 'bottle', water: 1 } });
  w.note({ id: 'note0', x: -5, z: 3, color: '#fff2b0', data: { kind: 'paper', loreIndex: 0 } });
  w.item({ id: 'food0', x: -8, z: 1, color: '#c98a3a', data: { kind: 'food', count: 1 } });
  w.item({ id: 'food1', x: 1, z: -1, color: '#c98a3a', data: { kind: 'food', count: 1 } });
  w.item({ id: 'food2', x: 8, z: -1, color: '#c98a3a', data: { kind: 'food', count: 1 } });
  w.item({ id: 'spraycan0', x: 0, z: 2, color: '#e8d27a', data: { kind: 'spraycan', count: 1 } });
  w.item({ id: 'backpack0', x: -8, z: 8, color: '#8a6a3a', data: { kind: 'backpack', count: 1 } });
}
