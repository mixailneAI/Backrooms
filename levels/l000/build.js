// Лобби: ручная расстановка без рандома — детерминизм doctor (9.19), проходы гарантированы.
export function build(w) {
  w.perimeter({ w: 24, d: 24 });
  w.floor({ x: 0, z: 0, w: 24, d: 24, type: 'carpet' });
  w.ceiling({ x: 0, z: 0, w: 24, d: 24, type: 'panels' });
  w.lightPanel({ x: -6, z: -8 }); w.lightPanel({ x: 6, z: -8 });
  w.lightPanel({ x: -6, z: 0 }); w.lightPanel({ x: 6, z: 0 });
  w.lightPanel({ x: -6, z: 8 }); w.lightPanel({ x: 6, z: 8 });
  w.box({ x: -6, z: -4, w: 8, d: 0.5 });
  w.box({ x: 6, z: -4, w: 8, d: 0.5 });
  w.box({ x: -6, z: 4, w: 8, d: 0.5 });
  w.box({ x: 6, z: 4, w: 8, d: 0.5 });
  w.box({ x: 0, z: -8, w: 0.5, d: 8 });
  w.box({ x: 0, z: 8, w: 0.5, d: 8 });
  w.spawn({ x: -9, z: -9 });
  w.exit({ id: 'exit0', x: 9, z: 9 });
  w.item({ id: 'water0', x: -5, z: 0 });
  w.note({ id: 'note0', x: -5, z: 3 });
}
