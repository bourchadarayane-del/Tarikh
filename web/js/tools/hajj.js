// Guide Omra / Hajj (Premium) : chapitres, étapes, invocations, erreurs fréquentes, checklist.
import { t, lang } from '../i18n.js';
import { h, clear, loading, errorBox, paragraphs } from '../ui.js';
import { store } from '../store.js';
import { isPremium, getPremiumContent } from '../premium.js';
import { premiumCta, premiumIndex } from './common.js';

export function render(body) {
  const locked = async () => {
    clear(body).append(loading());
    let index;
    try { index = await premiumIndex(lang()); } catch { clear(body).append(errorBox(locked)); return; }
    clear(body).append(h('p.muted', t('hajj.intro')),
      ...['umrah', 'hajj'].map((part) => h('div.card', h('p.label', index.hajj[part].title),
        h('ul.list', { style: 'margin-top:10px' }, index.hajj[part].chapters.map((c, i) => h('li.list-item', h('span.list-num', String(i + 1)), h('span.grow', c), h('span.badge-lock', '✦')))))),
      premiumCta('hajj.locked'));
  };
  const full = async () => {
    clear(body).append(loading());
    let g;
    try { g = await getPremiumContent('hajj'); } catch (err) { if (err.status === 402) { locked(); return; } clear(body).append(errorBox(full)); return; }
    let tab = 'umrah';
    const seg = h('div.seg', { role: 'group' });
    const content = h('div.stack');
    const chapter = (c, i) => h('details.card', h('summary', { style: 'min-height:44px;display:flex;align-items:center;gap:10px;cursor:pointer' }, h('span.list-num', String(i + 1)), h('b', c.title)),
      h('div.stack', { style: 'margin-top:12px' }, paragraphs(c.body),
        c.steps?.length ? h('ol', { style: 'margin:0;padding-inline-start:22px;display:grid;gap:6px' }, c.steps.map((s) => h('li', s))) : null,
        (c.duas || []).map((d) => h('div.card', { style: 'background:var(--card-2)' }, h('p.arabic', { lang: 'ar' }, d.ar), d.tr ? h('p.translit', d.tr) : null, h('p', d.t), h('p.muted', d.source)))));
    const paint = () => {
      clear(seg);
      for (const k of ['umrah', 'hajj', 'mistakes', 'checklist']) seg.append(h('button', { type: 'button', 'aria-pressed': String(k === tab), onclick: () => { tab = k; paint(); } }, t('hajj.tab.' + k)));
      clear(content);
      if (tab === 'umrah' || tab === 'hajj') content.append(h('h3.title.small', g[tab].title), ...paragraphs(g[tab].intro, 'muted'), ...g[tab].chapters.map(chapter));
      if (tab === 'mistakes') content.append(...g.mistakes.map((m) => h('div.card', h('b.gold', m.title), h('p', { style: 'margin-top:6px' }, m.body))));
      if (tab === 'checklist') {
        const done = store.get('hajjChecklist', []);
        const groups = [...new Set(g.checklist.map((c) => c.group))];
        content.append(h('p.muted', t('hajj.checkProgress', { n: g.checklist.filter((c) => done.includes(c.id)).length, total: g.checklist.length })),
          ...groups.map((grp) => h('div.card', h('p.label', t('hajj.group.' + grp)), g.checklist.filter((c) => c.group === grp).map((c) => h('label.check-row', h('input.check', { type: 'checkbox', checked: done.includes(c.id), onchange: (e) => {
            let d = store.get('hajjChecklist', []);
            d = e.target.checked ? [...new Set([...d, c.id])] : d.filter((x) => x !== c.id);
            store.set('hajjChecklist', d); paint();
          } }), h('span', c.label))))));
      }
    };
    clear(body).append(seg, content);
    paint();
  };
  if (isPremium()) full(); else locked();
}
