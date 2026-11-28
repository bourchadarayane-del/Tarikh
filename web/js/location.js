// Position de l'utilisateur : géolocalisation (facultative) ou choix d'une ville, avec recherche hors-ligne.
import { store } from './store.js';
import { t } from './i18n.js';
import { h, clear, loadData, toast } from './ui.js';
import { getPosition } from './native.js';
import { defaultMethod, defaultAsr } from './prayer.js';

export const getLocation = () => store.get('location');

export function setLocation(loc) {
  store.set('location', loc);
  const s = store.get('settings', {});
  // Méthode de calcul adaptée à la région, tant que l'utilisateur ne l'a pas choisie lui-même.
  if (!s.methodManual) { s.method = defaultMethod(loc.country); s.asr = defaultAsr(loc.country, tz()); store.set('settings', s); }
  document.dispatchEvent(new CustomEvent('tarikh:location'));
}
const tz = () => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch { return ''; } };
const norm = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

export async function searchCities(query, limit = 8) {
  const q = norm(query);
  if (q.length < 2) return [];
  const cities = await loadData('cities');
  const starts = [], contains = [];
  for (const c of cities) {
    const n = norm(c[0]);
    if (n.startsWith(q)) starts.push(c); else if (n.includes(q)) contains.push(c);
    if (starts.length >= limit) break;
  }
  const local = starts.concat(contains).slice(0, limit).map((c) => ({ name: c[0], country: c[1], lat: c[2], lon: c[3] }));
  if (local.length || navigator.onLine === false) return local;
  try { // Repli en ligne pour les petites villes (Open-Meteo, sans clé ni compte).
    const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?count=${limit}&name=${encodeURIComponent(query)}`);
    const data = await res.json();
    return (data.results || []).map((r) => ({ name: r.name, country: r.country_code, lat: r.latitude, lon: r.longitude }));
  } catch { return []; }
}

async function nearestCity(lat, lon) {
  try {
    const cities = await loadData('cities');
    let best = null, bd = Infinity;
    for (const c of cities) { const d = (c[2] - lat) ** 2 + ((c[3] - lon) * Math.cos((lat * Math.PI) / 180)) ** 2; if (d < bd) { bd = d; best = c; } }
    return best && bd < 1.5 ? { name: best[0], country: best[1] } : null;
  } catch { return null; }
}

export async function locateMe() {
  const pos = await getPosition();
  const near = await nearestCity(pos.lat, pos.lon);
  // On n'enregistre qu'une position arrondie (~1 km) : suffisant pour les horaires et la Qibla.
  const loc = { lat: +pos.lat.toFixed(2), lon: +pos.lon.toFixed(2), name: near?.name || t('location.mine'), country: near?.country || '', source: 'gps' };
  setLocation(loc);
  return loc;
}

// Bloc d'interface réutilisable : « Me localiser » + recherche de ville.
export function locationPicker(onDone) {
  const results = h('ul.list', { 'aria-live': 'polite' });
  const input = h('input.input', { type: 'search', id: 'city-search', autocomplete: 'off', placeholder: t('location.searchPh'), 'aria-label': t('location.search') });
  let timer;
  input.addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(async () => {
      const found = await searchCities(input.value);
      clear(results);
      if (!found.length && input.value.trim().length >= 2) results.append(h('li.muted', t('location.none')));
      for (const c of found) {
        results.append(h('li', h('button.list-item', { type: 'button', onclick: () => { setLocation({ ...c, source: 'city' }); onDone && onDone(c); } },
          h('span.grow', c.name), h('span.muted', c.country))));
      }
    }, 180);
  });
  const gps = h('button.btn.primary.block', { type: 'button', onclick: async () => {
    gps.disabled = true;
    try { const loc = await locateMe(); onDone && onDone(loc); }
    catch { toast(t('location.denied')); input.focus(); }
    finally { gps.disabled = false; }
  } }, '📍 ', t('location.useMine'));
  return h('div.stack', gps, h('p.muted.center', t('location.or')), input, results, h('p.muted', t('location.privacy')));
}
