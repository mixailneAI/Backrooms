// Единый контракт коллизий «точка/радиус против мира» (4.4). Два адаптера, скольжение по осям.
export function manualAdapter(colliders) {
  return {
    isFree(x, z, r = 0.3) {
      for (const c of colliders) {
        const hw = (c.w || 1) / 2 + r, hd = (c.d || 1) / 2 + r;
        if (Math.abs(x - (c.x || 0)) < hw && Math.abs(z - (c.z || 0)) < hd) return false;
      }
      return true;
    }
  };
}
export function chunkAdapter(world) {
  return { isFree: (x, z, r = 0.3) => world.isFree(x, z, r) };
}
export function moveWithSlide(pos, dx, dz, adapter, r = 0.3) {
  let x = pos.x, z = pos.z;
  if (adapter.isFree(x + dx, z, r)) x += dx;
  if (adapter.isFree(x, z + dz, r)) z += dz;
  return { x, z };
}
