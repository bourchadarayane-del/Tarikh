// Onglet Premium : écran d'abonnement conforme (prix, durée, renouvellement, liens légaux, restauration)
// pour un utilisateur gratuit ; espace abonné (historique, favoris, sections) sinon.
import { t } from '../i18n.js';
import { h, clear, openSheet, closeSheet, toast, loading } from '../ui.js';
import { isPremium, premium, getOffer, purchase, restore, manageSubscription } from '../premium.js';
import { isNative, openUrl } from '../native.js';
import { config } from '../config.js';
import { TOOLS } from '../tools/index.js';
import { fmtDate } from '../i18n.js';

export const legalUrl = (page) => `${isNative() ? config.siteUrl + '/' : ''}${page}.html`;
const legalLink = (page, label) => h('a', { href: legalUrl(page), target: '_blank', rel: 'noopener', onclick: (e) => { if (isNative()) { e.preventDefault(); openUrl(legalUrl(page)); } } }, label);

function paywall(root) {
  const priceBox = h('div.price-box', loading());
  const buy = h('button.btn.primary.block', { type: 'button', id: 'btn-subscribe', disabled: true }, t('premium.cta'));
  const restoreBtn = h('button.btn.ghost.block', { type: 'button', id: 'btn-restore', onclick: async () => {
    restoreBtn.disabled = true;
    try { const ok = await restore(); toast(ok ? t('premium.restored') : t('premium.nothingToRestore')); if (ok) closeSheet(); }
    catch { toast(t('common.error')); } finally { restoreBtn.disabled = false; }
  } }, t('premium.restore'));
  let offer = null;
  buy.addEventListener('click', async () => {
    buy.disabled = true;
    try {
      const res = await purchase(offer);
      if (res === 'purchased') { toast(t('premium.welcome'), 4000); closeSheet(); }
      else if (res === 'login_required') { toast(t('premium.loginFirst'), 3500); const { openAccount } = await import('./settings.js'); openAccount(); }
    } catch (err) { console.error(err); toast(t('premium.error'), 4000); }
    finally { buy.disabled = false; }
  });
  getOffer().then((o) => {
    offer = o;
    clear(priceBox);
    if (!o.available) { priceBox.append(h('p.muted', t('premium.unavailable'))); return; }
    const price = o.price || t('premium.webPrice');
    priceBox.append(
      o.trialDays ? h('p.label', t('premium.trial', { n: o.trialDays })) : null,
      h('p.price', { id: 'premium-price' }, t('premium.perMonth', { price })),
      h('p.muted', o.trialDays ? t('premium.thenRenews', { price }) : t('premium.renews', { price })));
    buy.textContent = o.trialDays ? t('premium.startTrial', { n: o.trialDays }) : t('premium.subscribe');
    buy.disabled = false;
  });
  root.append(
    h('div.paywall-hero', h('p.arabic.center', { lang: 'ar', style: 'font-size:2.4rem' }, 'تاريخ'), h('h1.title', t('premium.title')), h('p.muted', t('premium.subtitle'))),
    h('ul.feature-list.card', ['prophets', 'hajj', 'quiz', 'history', 'favorites', 'calendar'].map((k) => h('li', h('div', h('b', t('premium.f.' + k)), h('p.muted', t('premium.f.' + k + '.d')))))),
    priceBox, buy, restoreBtn,
    h('p.legal', isNative() ? t('premium.legal.ios') : t('premium.legal.web'), ' ', legalLink('terms', t('legal.terms')), ' · ', legalLink('privacy', t('legal.privacy'))),
    h('p.label.section-title', t('premium.preview')),
    h('div.grid', ['prophets', 'hajj', 'quiz'].map((name) => h('a.tile', { href: `#/tool/${name}` }, h('span.tile-ico', { 'aria-hidden': 'true' }, TOOLS[name].ico), h('span', t(`tool.${name}`))))));
}

function member(root) {
  const p = premium();
  const until = p.until ? fmtDate(new Date(p.until), { day: 'numeric', month: 'long', year: 'numeric' }) : null;
  root.append(
    h('div.card.gold-border', h('p.label', '✦ ' + t('premium.badge')), h('p', { style: 'margin-top:6px' }, p.trial ? t('premium.status.trial') : t('premium.status.active')),
      until ? h('p.muted', t(p.cancelAtPeriodEnd ? 'premium.status.ends' : 'premium.status.renews', { date: until })) : null,
      h('div.actions', h('button.btn.small.ghost', { type: 'button', onclick: () => manageSubscription().catch(() => toast(t('common.error'))) }, t('premium.manage')))),
    h('div.grid', ['prophets', 'hajj', 'quiz', 'favorites'].map((name) => h('a.tile', { href: `#/tool/${name}` }, h('span.tile-ico', { 'aria-hidden': 'true' }, TOOLS[name].ico), h('span', t(`tool.${name}`))))),
    h('p.label.section-title', t('tool.history')));
  const slot = h('div.stack');
  root.append(slot);
  TOOLS.history.load().then((mod) => mod.render(slot, 'history'));
}

export function renderPremiumTab(root) {
  clear(root);
  if (isPremium()) member(root); else paywall(root);
}

export function openPaywall() {
  if (isPremium()) { location.hash = '#/premium'; return; }
  openSheet({ title: t('premium.title'), render: (body) => paywall(body) });
}
