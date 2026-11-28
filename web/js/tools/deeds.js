// Bonnes actions : compteur du jour et total, actions à cocher, historique sur 30 jours.
import { t, fmtDate } from '../i18n.js';
import { h, clear } from '../ui.js';
import { store, getDaily, getTotal, addDays, dateKey } from '../store.js';
import { addDeed, MANUAL_DEEDS } from '../deeds.js';
import { hapticTap } from '../native.js';

export function render(body) {
  const paint = () => {
    clear(body);
    const log = store.get('deeds', {});
    const days = Array.from({ length: 30 }, (_, i) => addDays(new Date(), i - 29));
    const max = Math.max(1, ...days.map((d) => log[dateKey(d)] || 0));
    const active = days.filter((d) => log[dateKey(d)] > 0).length;
    const recent = store.get('deedsLog', []).slice(0, 12);
    body.append(
      h('div.stats', h('div.stat', h('b', { id: 'deeds-today' }, String(getDaily('deeds'))), h('span', t('deeds.today'))),
        h('div.stat', h('b', String(getTotal('deeds'))), h('span', t('deeds.total'))), h('div.stat', h('b', `${active}/30`), h('span', t('deeds.activeDays')))),
      h('p.muted', t('deeds.intro')),
      h('p.label.section-title', t('deeds.add')),
      h('div.grid', MANUAL_DEEDS.map((type) => h('button.tile', { type: 'button', dataset: { deed: type }, onclick: () => { addDeed(type); hapticTap(); paint(); } },
        h('span.tile-ico', { 'aria-hidden': 'true' }, '＋'), h('span', t('deeds.type.' + type))))),
      h('p.label.section-title', t('deeds.history')),
      h('div.card', h('div.bars', { role: 'img', 'aria-label': t('deeds.history') }, days.map((d, i) => h('span' + (i === 29 ? '.today' : ''), { style: `height:${Math.round(((log[dateKey(d)] || 0) / max) * 100)}%`, title: `${fmtDate(d, { day: 'numeric', month: 'short' })} : ${log[dateKey(d)] || 0}` }))),
        h('div.row.between.muted', { style: 'margin-top:6px' }, h('span', fmtDate(days[0], { day: 'numeric', month: 'short' })), h('span', t('common.today')))),
      recent.length ? h('ul.list', recent.map((r) => h('li.list-item', h('span.grow', t('deeds.type.' + r.t)), h('span.muted', r.d === dateKey() ? t('common.today') : r.d)))) : h('p.muted.center', t('deeds.empty')),
    );
  };
  paint();
}
