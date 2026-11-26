import { storage } from '../core/storage.js';

// Прогресс и настройки (4.4). Квота/private-mode переживает через core/storage (грабли 9.18).
export function createSave() {
  const st = storage({ version: 1 });
  const load = (k, def) => ({ ...def, ...(st.get(k, {}) || {}) });
  let progress = load('progress', { unlocked: ['l0'], notes: {}, deaths: 0, wins: 0 });
  let settings = load('settings', { sens: 1, invertY: false, vibration: true, sound: true });
  const persist = () => { st.set('progress', progress); st.set('settings', settings); };
  return {
    progress: () => progress,
    settings: () => settings,
    storageLive: () => st.live(),
    unlock(id) {
      if (progress.unlocked.includes(id)) return false;
      progress.unlocked.push(id); persist(); return true;
    },
    addNote(levelId, noteId) {
      const arr = progress.notes[levelId] || (progress.notes[levelId] = []);
      if (arr.includes(noteId)) return false;
      arr.push(noteId); persist(); return true;
    },
    death() { progress.deaths++; persist(); },
    win() { progress.wins++; persist(); },
    setSettings(patch) { settings = { ...settings, ...patch }; persist(); },
    emergency: () => !!st.get('emergency', false),
    setEmergency(v) { st.set('emergency', !!v); }
  };
}
