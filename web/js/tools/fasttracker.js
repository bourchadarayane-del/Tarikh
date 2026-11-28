// Suivi du jeûne : Ramadan x/30, jours à rattraper, jeûnes surérogatoires.
import { t } from '../i18n.js';
import { h, clear } from '../ui.js';
import { store } from '../store.js';
import { toHijri } from '../hijri.js';
import { hapticTap } from '../native.js';
import { addDeed } from '../deeds.js';

export function render(body) {
  const adjust = store.get('settings', {}).hijriAdjust || 0;
  const hNow = toHijri(new Date(), adjust);
  // Année du Ramadan en cours ou du dernier Ramadan passé.
  const year = hNow.m >= 9 ? hNow.y : hNow.y - 1;
  const paint = () => {
    clear(body);
    const all = store.get('fastLog', {});
    const y = { days: [], madeUp: 0, voluntary: 0, ...(all[year] || {}) };
    const save = () => { all[year] = y; store.set('fastLog', all); };
    const fasted = y.days.length;
    const missed = 30 - fasted;
    const counter = (label, key, max) => h('div.row.between', h('span.grow', label),
      h('button.btn.small.ghost', { type: 'button', 'aria-label': '−', onclick: () => { y[key] = Math.max(0, (y[key] || 0) - 1); save(); paint(); } }, '−'),
      h('b', { style: 'min-width:34px;text-align:center' }, String(y[key] || 0)),
      h('button.btn.small', { type: 'button', 'aria-label': '+', onclick: () => { if (max != null && (y[key] || 0) >= max) return; y[key] = (y[key] || 0) + 1; save(); hapticTap(); addDeed('fast'); paint(); } }, '+'));
    body.append(
      h('div.stats', h('div.stat', h('b', { id: 'fast-count' }, `${fasted}/30`), h('span', t('ftrack.ramadan', { y: year }))),
        h('div.stat', h('b', String(Math.max(0, missed - y.madeUp))), h('span', t('ftrack.toMakeUp'))), h('div.stat', h('b', String(y.voluntary)), h('span', t('ftrack.voluntary')))),
      h('div.progress', { role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': '30', 'aria-valuenow': String(fasted) }, h('span', { style: `width:${(fasted / 30) * 100}%` })),
      h('p.label.section-title', t('ftrack.days')),
      h('div.day-dots', Array.from({ length: 30 }, (_, i) => i + 1).map((d) => h('button.day-dot' + (y.days.includes(d) ? '.full' : ''), { type: 'button', 'aria-pressed': String(y.days.includes(d)), 'aria-label': t('ftrack.day', { n: d }), onclick: () => {
        if (y.days.includes(d)) y.days = y.days.filter((x) => x !== d); else { y.days.push(d); hapticTap(); addDeed('fast'); }
        save(); paint();
      } }, String(d)))),
      h('div.card.stack', counter(t('ftrack.madeUp'), 'madeUp', missed), counter(t('ftrack.voluntaryAdd'), 'voluntary', null)),
      h('p.muted', t('ftrack.help')));
  };
  paint();
}
