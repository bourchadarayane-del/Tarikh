import { t } from '../i18n.js';
import { h } from '../ui.js';

// Encart « réservé au Premium » avec bouton vers l'écran d'abonnement.
export const premiumCta = (textKey = 'premium.locked') => h('div.card.gold-border.center',
  h('p.label', '✦ Premium'), h('p', { style: 'margin:8px 0 12px' }, t(textKey)),
  h('button.btn.primary.block', { type: 'button', onclick: () => { location.hash = '#/paywall'; } }, t('premium.cta')));

export async function premiumIndex(lang) {
  const { loadData } = await import('../ui.js');
  try { return await loadData(`premium-index/${lang}`); } catch { return await loadData('premium-index/en'); }
}
