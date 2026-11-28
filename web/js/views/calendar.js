// Calendrier hégirien du mois : jours de jeûne en vert, jours symboliques en or, détail au clic.
import { t, fmtDate, pick, locale } from '../i18n.js';
import { h, clear, loadData, loading } from '../ui.js';
import { store, addDays, dateKey } from '../store.js';
import { hijriMonthDays, fastingInfo, toHijri } from '../hijri.js';
import { isPremium, getPremiumContent } from '../premium.js';
import { premiumCta } from '../tools/common.js';

let anchor = new Date();
let selectedKey = null;

export async function renderCalendar(root) {
  const adjust = store.get('settings', {}).hijriAdjust || 0;
  let days = [];
  try { days = await loadData('days'); } catch { /* le calendrier reste utilisable sans les jours symboliques */ }
  const special = (hd) => days.find((d) => d.month === hd.m && hd.d >= d.day && hd.d <= (d.endDay || d.day));
  const month = hijriMonthDays(anchor, adjust);
  const todayKey = dateKey();
  if (!selectedKey || !month.days.some((d) => dateKey(d.date) === selectedKey)) selectedKey = month.days.some((d) => dateKey(d.date) === todayKey) ? todayKey : dateKey(month.days[0].date);

  const detail = h('section.card', { id: 'cal-detail', 'aria-live': 'polite' });
  const showDetail = () => {
    const day = month.days.find((d) => dateKey(d.date) === selectedKey);
    if (!day) return;
    const info = fastingInfo(day.date, adjust);
    const sp = special(day.h);
    clear(detail).append(h('p.label', fmtDate(day.date, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })),
      h('h3.title.small', `${day.h.d} ${t('hijri.m' + day.h.m)} ${day.h.y}`));
    if (info.ramadan) detail.append(h('p.ok', '🌙 ' + t('fast.ramadan', { n: day.h.d })));
    else if (info.forbidden) detail.append(h('p.gold', t('fast.forbidden')));
    else if (info.recommended) detail.append(h('p.ok', '🌿 ' + t('cal.fastDay') + ' — ' + info.reasons.map((r) => t('fast.reason.' + r)).join(' · ')));
    if (sp) {
      detail.append(h('p.gold', { style: 'margin-top:10px;font-weight:700' }, '★ ' + pick(sp.title)), h('p', pick(sp.short)));
      if (isPremium()) {
        const slot = loading();
        detail.append(slot);
        getPremiumContent('days').then((d) => {
          const x = d[sp.id];
          slot.replaceWith(x ? h('div.stack', { style: 'margin-top:10px' }, ...String(x.detail).split(/\n{2,}/).map((p) => h('p', p)), x.sources?.length ? h('p.muted', t('cal.sources') + ' ' + x.sources.join(' · ')) : null) : h('span'));
        }).catch(() => slot.replaceWith(h('p.muted', t('common.error'))));
      } else {
        detail.append(h('div', { style: 'margin-top:12px' }, premiumCta('cal.locked')));
      }
    } else if (!info.recommended && !info.ramadan && !info.forbidden) detail.append(h('p.muted', t('cal.ordinary')));
  };

  // Semaine commençant le lundi ; noms de jours dans la langue de l'utilisateur.
  const dowFmt = new Intl.DateTimeFormat(locale(), { weekday: 'short' });
  const monday = new Date(2024, 0, 1);
  const grid = h('div.cal-grid', { role: 'grid', 'aria-label': t('tab.calendar') }, Array.from({ length: 7 }, (_, i) => h('div.cal-dow', { 'aria-hidden': 'true' }, dowFmt.format(addDays(monday, i)))));
  const offset = (month.days[0].date.getDay() + 6) % 7;
  for (let i = 0; i < offset; i++) grid.append(h('div.cal-day.cal-empty'));
  for (const day of month.days) {
    const info = fastingInfo(day.date, adjust);
    const sp = special(day.h);
    const key = dateKey(day.date);
    const cls = (sp ? '.special' : (info.recommended || info.ramadan) ? '.fast' : '') + (key === todayKey ? '.today' : '');
    grid.append(h('button.cal-day' + cls, { type: 'button', 'aria-pressed': String(key === selectedKey), dataset: { day: key },
      'aria-label': `${day.h.d} ${t('hijri.m' + day.h.m)}, ${fmtDate(day.date, { day: 'numeric', month: 'long' })}${sp ? ', ' + pick(sp.title) : info.recommended ? ', ' + t('cal.fastDay') : ''}`,
      onclick: (e) => { selectedKey = key; grid.querySelectorAll('.cal-day').forEach((b) => b.setAttribute('aria-pressed', 'false')); e.currentTarget.setAttribute('aria-pressed', 'true'); showDetail(); } },
      h('b', String(day.h.d)), h('small', String(day.date.getDate()))));
  }
  const shift = (n) => { anchor = addDays(month.days[n < 0 ? 0 : month.days.length - 1].date, n < 0 ? -2 : 2); selectedKey = null; renderCalendar(root); };
  const isCurrent = toHijri(new Date(), adjust).m === month.m && toHijri(new Date(), adjust).y === month.y;
  clear(root).append(
    h('div.card',
      h('div.cal-head', h('button.icon-btn', { type: 'button', 'aria-label': t('cal.prev'), onclick: () => shift(-1) }, '‹'),
        h('div.center', h('h1.title.small', { style: 'margin:0' }, `${t('hijri.m' + month.m)} ${month.y}`),
          h('p.muted', `${fmtDate(month.days[0].date, { day: 'numeric', month: 'short' })} – ${fmtDate(month.days[month.days.length - 1].date, { day: 'numeric', month: 'short', year: 'numeric' })}`)),
        h('button.icon-btn', { type: 'button', 'aria-label': t('cal.next'), onclick: () => shift(1) }, '›')),
      grid,
      h('div.legend', h('span', h('i', { style: 'background:var(--ok)' }), t('cal.legend.fast')), h('span', h('i', { style: 'background:var(--gold)' }), t('cal.legend.special')),
        isCurrent ? null : h('button.chip', { type: 'button', onclick: () => { anchor = new Date(); selectedKey = null; renderCalendar(root); } }, t('cal.today')))),
    detail, h('p.muted.center', t('cal.note')));
  showDetail();
}
