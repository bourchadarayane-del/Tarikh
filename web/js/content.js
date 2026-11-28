// Contenus du jour : lus dans Supabase (clé publique), mis en cache par date LOCALE,
// avec repli sur la bibliothèque embarquée (toujours quelque chose à lire, même hors-ligne).
import { config } from './config.js';
import { store, dateKey, dayNumber, addDays } from './store.js';
import { lang } from './i18n.js';
import { loadData } from './ui.js';

const configured = () => !!(config.supabaseUrl && config.supabaseAnonKey);

async function rest(query, timeout = 7000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeout);
  try {
    const res = await fetch(`${config.supabaseUrl}/rest/v1/${query}`, {
      signal: ctrl.signal,
      headers: { apikey: config.supabaseAnonKey, authorization: `Bearer ${config.supabaseAnonKey}` },
    });
    if (!res.ok) throw new Error(`rest_${res.status}`);
    return await res.json();
  } finally { clearTimeout(timer); }
}

function prune(prefix, keepDays = 8) {
  const limit = dateKey(addDays(new Date(), -keepDays));
  for (const k of store.keys(prefix)) { const d = k.split(':')[1]; if (d && d < limit) store.del(k); }
}

// Histoire du jour : { title, era, period, teaser, story, lesson, topic_key, date, origin }
export async function getStory(date = new Date()) {
  const l = lang(), day = dateKey(date), key = `story:${day}:${l}`;
  const cached = store.get(key);
  if (cached) return { ...cached, origin: 'cache' };
  if (configured() && navigator.onLine !== false) {
    try {
      const rows = await rest(`daily_stories?date=eq.${day}&lang=eq.${l}&select=date,lang,title,era,period,teaser,story,lesson,topic_key&limit=1`);
      if (rows[0]) { store.set(key, rows[0]); prune('story:'); remember(rows[0]); return { ...rows[0], origin: 'live' }; }
    } catch { /* réseau lent ou coupé : repli */ }
  }
  try {
    const seeds = await loadData(`stories/${l}`);
    const s = seeds[((dayNumber(date) % seeds.length) + seeds.length) % seeds.length];
    const story = { ...s, date: day, lang: l };
    remember(story);
    return { ...story, origin: 'seed' };
  } catch {
    const last = store.get('history', []).find((x) => x.lang === l) || store.get('history', [])[0];
    if (last) return { ...last, origin: 'last' };
    throw new Error('no_story');
  }
}

// Rappel du jour : hadith authentique tiré d'une liste vérifiée (jamais généré par l'IA).
export async function getReminder(date = new Date()) {
  const l = lang(), day = dateKey(date), key = `reminder:${day}:${l}`;
  const cached = store.get(key);
  if (cached) return cached;
  if (configured() && navigator.onLine !== false) {
    try {
      const rows = await rest(`daily_reminders?date=eq.${day}&lang=eq.${l}&select=date,lang,hadith_id,arabic,text,narrator,source&limit=1`);
      if (rows[0]) { store.set(key, rows[0]); prune('reminder:'); return rows[0]; }
    } catch { /* repli */ }
  }
  const pool = await loadData('hadiths');
  const hd = pool[((dayNumber(date) % pool.length) + pool.length) % pool.length];
  return { date: day, lang: l, hadith_id: hd.id, arabic: hd.ar, text: hd.t[l] || hd.t.en, narrator: (hd.narrator && (hd.narrator[l] || hd.narrator.en)) || '', source: hd.ref[l] || hd.ref.en };
}

// Historique local des histoires lues (les 3 dernières pour la version gratuite).
function remember(story) {
  const list = store.get('history', []).filter((s) => !(s.date === story.date && s.lang === story.lang));
  list.unshift({ date: story.date, lang: story.lang, title: story.title, era: story.era, period: story.period, teaser: story.teaser, story: story.story, lesson: story.lesson, topic_key: story.topic_key });
  store.set('history', list.slice(0, 40));
}
export const localHistory = () => store.get('history', []);

// Favoris (stockés sur l'appareil ; fonction Premium).
export const favorites = () => store.get('favorites', []);
export const isFavorite = (story) => favorites().some((f) => f.topic_key === story.topic_key && f.lang === story.lang);
export function toggleFavorite(story) {
  let list = favorites();
  const on = !isFavorite(story);
  list = list.filter((f) => !(f.topic_key === story.topic_key && f.lang === story.lang));
  if (on) list.unshift({ date: story.date, lang: story.lang, title: story.title, era: story.era, period: story.period, teaser: story.teaser, story: story.story, lesson: story.lesson, topic_key: story.topic_key });
  store.set('favorites', list);
  return on;
}
