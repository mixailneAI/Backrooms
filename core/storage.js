// Namespaced-обёртка localStorage: JSON, квота/private-mode, миграция версий, fallback в память (грабли 9.18).
const PREFIX = 'backrooms:';
export function storage(opts = {}) {
  const version = opts.version || 1;
  const migrate = typeof opts.migrate === 'function' ? opts.migrate : null;
  const mem = new Map();
  let live = false;
  try { const k = PREFIX + '__probe'; localStorage.setItem(k, '1'); localStorage.removeItem(k); live = true; } catch (e) { live = false; }
  const rawGet = k => { if (live) { try { return localStorage.getItem(PREFIX + k); } catch (e) { live = false; } } return mem.has(k) ? mem.get(k) : null; };
  const rawSet = (k, v) => { mem.set(k, v); if (live) { try { localStorage.setItem(PREFIX + k, v); return true; } catch (e) { live = false; } } return false; };
  return {
    live: () => live,
    get(key, fallback = null) {
      const raw = rawGet(key);
      if (raw == null) return fallback;
      try {
        const env = JSON.parse(raw);
        if (env && typeof env === 'object' && 'v' in env) {
          let data = env.data;
          if (env.v !== version && migrate) { data = migrate(data, env.v); rawSet(key, JSON.stringify({ v: version, data })); }
          return data;
        }
        return env;
      } catch (e) { return fallback; }
    },
    set(key, data) { return rawSet(key, JSON.stringify({ v: version, data })); },
    del(key) { mem.delete(key); if (live) { try { localStorage.removeItem(PREFIX + key); } catch (e) { live = false; } } }
  };
}
