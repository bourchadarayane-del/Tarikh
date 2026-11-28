// Registre des outils (chargés à la demande) et ouverture dans une bottom sheet.
import { t } from '../i18n.js';
import { openSheet, loading, errorBox, clear } from '../ui.js';
import { isPremium } from '../premium.js';
import { openExternal, openUrl } from '../native.js';
import { QURAN_URL, KAABA_LIVE_URL } from '../config.js';
import { getLocation } from '../location.js';

export const TOOLS = {
  tasbih: { ico: '📿', load: () => import('./tasbih.js') },
  qibla: { ico: '🧭', load: () => import('./qibla.js') },
  names: { ico: '✨', load: () => import('./names.js') },
  duas: { ico: '🤲', load: () => import('./duas.js') },
  adhkar: { ico: '🕌', load: () => import('./adhkar.js') },
  deeds: { ico: '🌱', load: () => import('./deeds.js') },
  zakat: { ico: '💰', load: () => import('./zakat.js') },
  prayers: { ico: '✅', load: () => import('./prayertracker.js') },
  fasting: { ico: '🌙', load: () => import('./fasttracker.js') },
  ramadan: { ico: '⏳', load: () => import('./ramadan.js') },
  prophets: { ico: '📖', premium: true, load: () => import('./prophets.js') },
  hajj: { ico: '🕋', premium: true, load: () => import('./hajj.js') },
  quiz: { ico: '❓', premium: true, load: () => import('./quiz.js') },
  history: { ico: '📜', premium: true, load: () => import('./history.js') },
  favorites: { ico: '♥', premium: true, load: () => import('./history.js'), arg: 'favorites' },
};
// Liens externes (pas de contenu embarqué).
export const LINKS = {
  mosques: { ico: '📍', open: () => {
    const loc = getLocation();
    const q = encodeURIComponent('mosque');
    const isApple = /iPhone|iPad|Macintosh/.test(navigator.userAgent);
    const near = loc ? (isApple ? `&sll=${loc.lat},${loc.lon}` : `/@${loc.lat},${loc.lon},14z`) : '';
    openExternal(isApple ? `https://maps.apple.com/?q=${q}${near}` : `https://www.google.com/maps/search/${q}${near}`);
  } },
  kaaba: { ico: '🎥', open: () => openUrl(KAABA_LIVE_URL) },
  quran: { ico: '📗', open: () => openUrl(QURAN_URL) },
};

export function openTool(name, arg) {
  const tool = TOOLS[name];
  if (!tool) return false;
  let cleanup = null;
  openSheet({
    title: t(`tool.${name}`),
    onClose: () => { if (typeof cleanup === 'function') cleanup(); },
    render: (body) => {
      body.append(loading());
      const run = () => tool.load().then((mod) => { clear(body); cleanup = mod.render(body, arg ?? tool.arg) || null; })
        .catch((err) => { console.error(err); clear(body); body.append(errorBox(() => { clear(body); body.append(loading()); run(); })); });
      run();
    },
  });
  if (location.hash !== `#/tool/${name}`) history.replaceState(null, '', `#/tool/${name}`);
  return true;
}
export const toolLocked = (name) => !!TOOLS[name]?.premium && !isPremium();
