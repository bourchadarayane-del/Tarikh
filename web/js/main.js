// Point d'entrée : démarrage, routage par hash, onglets.
import { setLang, detectLang, t, applyI18n } from './i18n.js';
import { store, touchStreak } from './store.js';
import { initSheet, closeSheet, sheetIsOpen } from './ui.js';
import { isNative, hideSplash, onResume } from './native.js';
import { consumeHashSession } from './auth.js';
import { initPurchases, refreshPremium, onPremiumChange, isPremium } from './premium.js';
import { initPush, rescheduleNotifications } from './notifications.js';
import { renderToday, stopToday } from './views/today.js';
import { renderCalendar } from './views/calendar.js';
import { renderPremiumTab, openPaywall } from './views/premiumtab.js';
import { openSettings } from './views/settings.js';
import { maybeOnboard } from './views/onboarding.js';
import { openTool, TOOLS } from './tools/index.js';

const TABS = ['today', 'calendar', 'premium'];
const $ = (id) => document.getElementById(id);

function showTab(tab) {
  document.body.dataset.tab = tab;
  for (const name of TABS) {
    $(`view-${name}`).hidden = name !== tab;
    const link = $(`tab-${name}`);
    if (name === tab) link.setAttribute('aria-current', 'page'); else link.removeAttribute('aria-current');
  }
  if (tab !== 'today') stopToday();
  if (tab === 'today') renderToday($('view-today'));
  if (tab === 'calendar') renderCalendar($('view-calendar'));
  if (tab === 'premium') renderPremiumTab($('view-premium'));
  window.scrollTo(0, 0);
}

function route() {
  const parts = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  const [head, arg] = parts;
  if (TABS.includes(head) && !arg) { if (sheetIsOpen()) closeSheet(false); showTab(head); return; }
  if (head === 'tool' && TOOLS[arg]) { openTool(arg); return; }
  if (head === 'settings') { openSettings(); return; }
  if (head === 'paywall') { openPaywall(); return; }
  if (!TABS.includes(document.body.dataset.tab)) document.body.dataset.tab = 'today';
  if (!head) showTab('today');
}

export function refreshChrome() {
  const on = isPremium();
  const btn = $('btn-premium');
  btn.classList.toggle('is-premium', on);
  btn.textContent = on ? t('premium.badge') : t('premium.cta.short');
  btn.setAttribute('aria-label', on ? t('premium.badge.aria') : t('premium.cta'));
  // Pour un abonné, le 3e onglet devient « Historique ».
  $('tab-premium-ico').textContent = on ? '📜' : '✦';
  const label = $('tab-premium-label');
  label.dataset.i18n = on ? 'tab.history' : 'tab.premium';
  label.textContent = t(label.dataset.i18n);
}
export function rerender() {
  applyI18n();
  refreshChrome();
  showTab(document.body.dataset.tab || 'today');
}

async function boot() {
  setLang(detectLang(), false);
  document.body.classList.toggle('native', isNative());
  initSheet();
  await consumeHashSession().catch(() => null);
  touchStreak();
  $('btn-settings').addEventListener('click', () => { location.hash = '#/settings'; });
  $('btn-premium').addEventListener('click', () => { location.hash = isPremium() ? '#/premium' : '#/paywall'; });
  window.addEventListener('hashchange', route);
  document.addEventListener('tarikh:lang', rerender);
  onPremiumChange(() => rerender());
  refreshChrome();
  if (!location.hash || location.hash === '#') history.replaceState(null, '', '#/today');
  showTab('today');
  route();

  // Écran de démarrage : 2,5 s (raccourci si l'utilisateur préfère moins d'animations).
  const reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  hideSplash();
  setTimeout(() => { $('splash').classList.add('hide'); setTimeout(() => $('splash').remove(), 500); maybeOnboard(); }, reduce || store.get('splashSeen') === new Date().toDateString() ? 600 : 2500);
  store.set('splashSeen', new Date().toDateString());

  // Service worker : uniquement sur le web (en natif, les fichiers sont déjà dans l'appli).
  if (!isNative() && 'serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }

  // Retour de Stripe Checkout (web).
  const params = new URLSearchParams(location.search);
  const checkout = params.get('checkout');
  if (checkout) history.replaceState(null, '', location.pathname + location.hash);

  await initPurchases();
  initPush();
  refreshPremium({ force: checkout === 'success' }).then(async (s) => {
    if (checkout === 'success') { const { toast } = await import('./ui.js'); toast(s.active ? t('premium.welcome') : t('premium.pending'), 4000); }
  });
  rescheduleNotifications();
  onResume(() => {
    touchStreak();
    refreshPremium();
    rescheduleNotifications();
    if (document.body.dataset.tab === 'today' && !sheetIsOpen()) renderToday($('view-today'));
  });
}

boot().catch((err) => {
  console.error(err);
  const s = document.getElementById('splash');
  if (s) s.remove();
});
