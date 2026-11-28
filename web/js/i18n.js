// Traductions : 6 langues embarquées (disponibles hors-ligne), détection automatique, RTL réel.
import fr from '../i18n/fr.json';
import en from '../i18n/en.json';
import ar from '../i18n/ar.json';
import es from '../i18n/es.json';
import id from '../i18n/id.json';
import ur from '../i18n/ur.json';
import { store } from './store.js';

export const LANGS = {
  fr: { name: 'Français', dir: 'ltr', locale: 'fr-FR', speech: 'fr-FR' },
  en: { name: 'English', dir: 'ltr', locale: 'en-GB', speech: 'en-US' },
  ar: { name: 'العربية', dir: 'rtl', locale: 'ar', speech: 'ar-SA' },
  es: { name: 'Español', dir: 'ltr', locale: 'es-ES', speech: 'es-ES' },
  id: { name: 'Bahasa Indonesia', dir: 'ltr', locale: 'id-ID', speech: 'id-ID' },
  ur: { name: 'اردو', dir: 'rtl', locale: 'ur', speech: 'ur-PK' },
};
const DICT = { fr, en, ar, es, id, ur };
let current = 'fr';

export function detectLang() {
  const saved = store.get('lang');
  if (saved && LANGS[saved]) return saved;
  const prefs = (typeof navigator !== 'undefined' && (navigator.languages || [navigator.language])) || [];
  for (const p of prefs) {
    const code = String(p || '').toLowerCase().split('-')[0];
    if (code === 'ms') return 'id';
    if (LANGS[code]) return code;
  }
  return 'fr';
}

export const lang = () => current;
export const dir = () => LANGS[current].dir;
// Chiffres latins partout pour rester lisible et cohérent avec les horaires.
export const locale = () => `${LANGS[current].locale}-u-nu-latn`;

export function t(key, vars) {
  let s = DICT[current][key] ?? DICT.en[key] ?? DICT.fr[key] ?? key;
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(String(v));
  return s;
}
// Texte localisé d'un objet de données { fr, en, ar, ... }.
export const pick = (obj) => (obj && (obj[current] || obj.en || obj.fr)) || '';

export function applyI18n(root = document) {
  root.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
  root.querySelectorAll('[data-i18n-aria]').forEach((el) => { el.setAttribute('aria-label', t(el.dataset.i18nAria)); });
  root.querySelectorAll('[data-i18n-ph]').forEach((el) => { el.setAttribute('placeholder', t(el.dataset.i18nPh)); });
}

export function setLang(code, persist = true) {
  current = LANGS[code] ? code : 'fr';
  if (persist) store.set('lang', current);
  if (typeof document !== 'undefined') {
    document.documentElement.lang = current;
    document.documentElement.dir = LANGS[current].dir;
    document.title = t('app.title');
    applyI18n();
  }
  return current;
}

export const fmtTime = (d) => (d instanceof Date && !isNaN(d) ? new Intl.DateTimeFormat(locale(), { hour: '2-digit', minute: '2-digit' }).format(d) : '--:--');
export const fmtDate = (d, opts = { weekday: 'long', day: 'numeric', month: 'long' }) => new Intl.DateTimeFormat(locale(), opts).format(d);
export const fmtNum = (n, opts) => new Intl.NumberFormat(locale(), opts).format(n);
export const hijriLabel = (h) => `${h.d} ${t('hijri.m' + h.m)} ${h.y}`;
