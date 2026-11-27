// Stockage local (préfixé) + utilitaires de date. Tout reste sur l'appareil.
const NS = 'tarikh:';
const mem = new Map();
const ls = () => { try { return globalThis.localStorage || null; } catch { return null; } };

export const store = {
  get(key, fallback = null) {
    try {
      const raw = ls() ? ls().getItem(NS + key) : mem.get(key);
      return raw == null ? fallback : JSON.parse(raw);
    } catch { return fallback; }
  },
  set(key, value) {
    const raw = JSON.stringify(value);
    try { if (ls()) ls().setItem(NS + key, raw); else mem.set(key, raw); } catch { mem.set(key, raw); }
  },
  del(key) { try { if (ls()) ls().removeItem(NS + key); } catch { /* ignore */ } mem.delete(key); },
  keys(prefix = '') {
    const out = [];
    try {
      const s = ls();
      if (s) for (let i = 0; i < s.length; i++) { const k = s.key(i); if (k && k.startsWith(NS + prefix)) out.push(k.slice(NS.length)); }
    } catch { /* ignore */ }
    for (const k of mem.keys()) if (k.startsWith(prefix) && !out.includes(k)) out.push(k);
    return out;
  },
  exportAll() { const data = {}; for (const k of this.keys()) data[k] = this.get(k); return data; },
  clearAll() { for (const k of this.keys()) this.del(k); },
};

const pad = (n) => String(n).padStart(2, '0');
// Date LOCALE de l'utilisateur (jamais UTC) au format AAAA-MM-JJ.
export function dateKey(d = new Date()) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
export function parseDateKey(key) { const [y, m, d] = key.split('-').map(Number); return new Date(y, m - 1, d, 12); }
export function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
export function dayNumber(d = new Date()) { return Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000); }

export function deviceId() {
  let id = store.get('deviceId');
  if (!id) {
    id = globalThis.crypto?.randomUUID ? crypto.randomUUID()
      : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => { const r = (Math.random() * 16) | 0; return (c === 'x' ? r : (r & 3) | 8).toString(16); });
    store.set('deviceId', id);
  }
  return id;
}

// Série de jours consécutifs d'ouverture de l'appli.
export function touchStreak(today = new Date()) {
  const s = store.get('streak', { last: null, count: 0, best: 0 });
  const key = dateKey(today);
  if (s.last === key) return s;
  s.count = s.last === dateKey(addDays(today, -1)) ? s.count + 1 : 1;
  s.best = Math.max(s.best || 0, s.count);
  s.last = key;
  store.set('streak', s);
  return s;
}

// Journal générique « un compteur par jour » (bonnes actions, tasbih, etc.).
export function addDaily(name, amount, d = new Date()) {
  const log = store.get(name, {});
  const k = dateKey(d);
  log[k] = Math.max(0, (log[k] || 0) + amount);
  store.set(name, log);
  store.set(name + ':total', Math.max(0, store.get(name + ':total', 0) + amount));
  return log[k];
}
export const getDaily = (name, d = new Date()) => store.get(name, {})[dateKey(d)] || 0;
export const getTotal = (name) => store.get(name + ':total', 0);
