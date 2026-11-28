// Suivi des 5 prières sur 30 jours : régularité et séries.
import { t, fmtDate } from '../i18n.js';
import { h, clear } from '../ui.js';
import { store, dateKey, addDays } from '../store.js';
import { hapticTap } from '../native.js';
import { addDeed } from '../deeds.js';

const FIVE = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];
export function render(body) {
  let selected = dateKey();
  const paint = () => {
    clear(body);
    const log = store.get('prayerLog', {});
    const days = Array.from({ length: 30 }, (_, i) => addDays(new Date(), i - 29));
    const count = (d) => FIVE.filter((p) => log[dateKey(d)]?.[p]).length;
    const done = days.reduce((s, d) => s + count(d), 0);
    let streak = 0;
    for (let i = 29; i >= 0; i--) { if (count(days[i]) === 5) streak++; else if (i !== 29) break; }
    const sel = log[selected] || {};
    body.append(
      h('div.stats', h('div.stat', h('b', `${Math.round((done / 150) * 100)}%`), h('span', t('ptrack.regularity'))),
        h('div.stat', h('b', String(streak)), h('span', t('ptrack.streak'))), h('div.stat', h('b', `${done}/150`), h('span', t('ptrack.total')))),
      h('div.card', h('p.label', selected === dateKey() ? t('common.today') : fmtDate(new Date(selected + 'T12:00'))),
        FIVE.map((p) => h('label.check-row', h('input.check', { type: 'checkbox', checked: !!sel[p], dataset: { prayer: p }, onchange: (e) => {
          const l = store.get('prayerLog', {});
          l[selected] = { ...(l[selected] || {}), [p]: e.target.checked };
          store.set('prayerLog', l);
          if (e.target.checked) { hapticTap(); addDeed('prayer'); }
          paint();
        } }), h('span', t('prayer.' + p))))),
      h('p.label.section-title', t('ptrack.last30')),
      h('div.day-dots', days.map((d) => { const n = count(d); const k = dateKey(d);
        return h('button.day-dot' + (n === 5 ? '.full' : n ? '.part' : ''), { type: 'button', 'aria-label': `${fmtDate(d, { day: 'numeric', month: 'long' })} : ${n}/5`, 'aria-pressed': String(k === selected), style: k === selected ? 'outline:2px solid var(--gold-soft)' : '', onclick: () => { selected = k; paint(); } }, String(d.getDate())); })),
      h('p.muted', t('ptrack.help')));
  };
  paint();
}
