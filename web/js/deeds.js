// Bonnes actions (« hassanettes ») : chaque usage utile de l'appli en ajoute une. Données locales uniquement.
import { store, addDaily, dateKey } from './store.js';

export const DEED_TYPES = ['story', 'reminder', 'prayer', 'fast', 'dhikr', 'dua', 'adhkar', 'zakat', 'quiz', 'prophet', 'charity', 'quran', 'parents', 'smile', 'help', 'knowledge'];
// Actions que l'utilisateur peut cocher lui-même.
export const MANUAL_DEEDS = ['charity', 'quran', 'parents', 'smile', 'help', 'knowledge'];

// `once` : une seule fois par jour pour cette clé (ex. lecture de l'histoire du jour).
export function addDeed(type, { once = null, amount = 1 } = {}) {
  if (once) {
    const k = `deedOnce:${dateKey()}`;
    const done = store.get(k, []);
    if (done.includes(once)) return false;
    done.push(once);
    store.set(k, done);
    for (const old of store.keys('deedOnce:')) if (old !== k) store.del(old);
  }
  addDaily('deeds', amount);
  const log = store.get('deedsLog', []);
  log.unshift({ d: dateKey(), t: type, n: amount });
  store.set('deedsLog', log.slice(0, 300));
  if (typeof document !== 'undefined') document.dispatchEvent(new CustomEvent('tarikh:deeds'));
  return true;
}
