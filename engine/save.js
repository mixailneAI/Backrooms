import { storage } from '../core/storage.js';

// Progress and settings survive private mode and older local save schemas.
export function createSave() {
  const store = storage({ version: 1 });
  const load = (key, defaults) => ({ ...defaults, ...(store.get(key, {}) || {}) });
  let progress = load('progress', { unlocked: ['l0'], notes: {}, deaths: 0, wins: 0 });
  const storedSettings = store.get('settings', {}) || {};
  const storedItems = store.get('items', {}) || {};
  let items = storedItems && typeof storedItems === 'object' && !Array.isArray(storedItems) ? { ...storedItems } : {};
  if (!Number.isFinite(Number(items.arrows))) items.arrows = 5;
  let settings = { sens: 1, invertY: false, vibration: true, sound: true, quality: 'medium', adaptive: true, ...storedSettings, sensV2: storedSettings.sensV2 === true };
  const persist = () => { store.set('progress', progress); store.set('settings', settings); };
  const persistItems = () => store.set('items', items);

  // V2 sensitivity is a 1..10 scale with a sqrt response curve.
  // Preserve a valid legacy sens/sensitivity value instead of silently resetting it.
  if (settings.sensV2 !== true) {
    const legacyValue = storedSettings.sens ?? storedSettings.sensitivity ?? 1;
    const legacy = Number(legacyValue);
    settings = { ...settings, sens: Math.max(1, Math.min(10, Number.isFinite(legacy) ? legacy : 1)), sensV2: true };
    persist();
  }
  if (!Array.isArray(progress.unlocked)) progress.unlocked = ['l0'];
  if (!progress.notes || typeof progress.notes !== 'object') progress.notes = {};
  progress.deaths = Math.max(0, Number(progress.deaths) || 0);
  progress.wins = Math.max(0, Number(progress.wins) || 0);

  const api = {
    progress: () => progress,
    settings: () => settings,
    storageLive: () => store.live(),
    items: () => ({ ...items }),
    getItem(key, fallback = null) { return Object.prototype.hasOwnProperty.call(items, key) ? items[key] : fallback; },
    setItem(key, value) {
      if (typeof key !== 'string' || !key) return false;
      items[key] = value;
      persistItems();
      return true;
    },
    addArrows(amount) {
      const add = Math.max(0, Math.floor(Number(amount) || 0));
      api.arrows = api.arrows + add;
      return api.arrows;
    },
    spendArrow(amount = 1) {
      const cost = Math.max(1, Math.floor(Number(amount) || 1));
      if (api.arrows < cost) return false;
      api.arrows = api.arrows - cost;
      return true;
    },
    unlock(id) {
      if (progress.unlocked.includes(id)) return false;
      progress.unlocked.push(id);
      persist();
      return true;
    },
    addNote(levelId, noteId) {
      const notes = progress.notes[levelId] || (progress.notes[levelId] = []);
      if (notes.includes(noteId)) return false;
      notes.push(noteId);
      persist();
      return true;
    },
    death() { progress.deaths++; persist(); },
    win() { progress.wins++; persist(); },
    setSettings(patch) {
      const next = { ...patch };
      if ('sens' in next) next.sens = Math.max(1, Math.min(10, Number(next.sens) || 1));
      settings = { ...settings, ...next };
      persist();
      return settings;
    },
    emergency: () => !!store.get('emergency', false),
    setEmergency(value) { store.set('emergency', !!value); }
  };
  Object.defineProperty(api, 'arrows', {
    enumerable: true,
    get() { return Math.max(0, Math.floor(Number(items.arrows) || 0)); },
    set(value) { items.arrows = Math.max(0, Math.floor(Number(value) || 0)); persistItems(); }
  });
  persistItems();
  return api;
}
