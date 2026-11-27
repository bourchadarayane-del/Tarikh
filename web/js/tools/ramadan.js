// Compte à rebours du Ramadan (date estimée selon le calendrier Umm al-Qura, à confirmer par l'observation de la lune).
import { t, fmtDate } from '../i18n.js';
import { h } from '../ui.js';
import { store } from '../store.js';
import { toHijri, nextHijriDate } from '../hijri.js';

export function render(body) {
  const adjust = store.get('settings', {}).hijriAdjust || 0;
  const now = new Date();
  const hNow = toHijri(now, adjust);
  const days = (d) => Math.round((new Date(d.getFullYear(), d.getMonth(), d.getDate()) - new Date(now.getFullYear(), now.getMonth(), now.getDate())) / 86400000);
  if (hNow.m === 9) {
    const eid = nextHijriDate(10, 1, now, adjust);
    body.append(h('div.price-box', h('p.label', t('ramadan.now')), h('p.price', t('ramadan.dayN', { n: hNow.d })),
      h('div.progress', { style: 'margin:12px 0' }, h('span', { style: `width:${(hNow.d / 30) * 100}%` })),
      eid ? h('p', t('ramadan.eidIn', { n: days(eid), date: fmtDate(eid) })) : null),
      hNow.d >= 21 ? h('div.alert.gold', h('span', '★'), h('div', t('ramadan.lastTen'))) : null);
  } else {
    const start = nextHijriDate(9, 1, now, adjust);
    body.append(h('div.price-box', h('p.label', t('ramadan.in')), h('p.price', { id: 'ramadan-days' }, t('ramadan.days', { n: start ? days(start) : '—' })), start ? h('p', fmtDate(start, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })) : null));
  }
  body.append(h('p.muted', t('ramadan.note')),
    h('ul.feature-list', ['ramadan.tip1', 'ramadan.tip2', 'ramadan.tip3'].map((k) => h('li', t(k)))));
}
