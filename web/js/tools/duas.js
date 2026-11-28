// Douaas : arabe vocalisé, translittération, traduction, source. Filtre par thème.
import { t, pick } from '../i18n.js';
import { h, clear, loadData, toast } from '../ui.js';
import { shareText } from '../native.js';
import { addDeed } from '../deeds.js';

export function render(body) {
  const list = h('div.stack');
  const chips = h('div.row.wrap');
  body.append(chips, list);
  loadData('duas').then((duas) => {
    const cats = ['all', ...new Set(duas.map((d) => d.cat))];
    let cat = 'all';
    const paint = () => {
      clear(chips);
      for (const c of cats) chips.append(h('button.chip', { type: 'button', 'aria-pressed': String(c === cat), style: c === cat ? 'border-color:var(--gold);color:var(--gold)' : '', onclick: () => { cat = c; paint(); } }, t('duas.cat.' + c)));
      clear(list);
      for (const d of duas.filter((x) => cat === 'all' || x.cat === cat)) {
        list.append(h('article.card.dua-card',
          h('p.label', pick(d.title)),
          h('p.arabic', { lang: 'ar' }, d.ar),
          h('p.translit', d.tr),
          h('p', { style: 'margin-top:6px' }, pick(d.t)),
          h('div.row.between', { style: 'margin-top:8px' }, h('span.muted', pick(d.source)),
            h('button.btn.small.ghost', { type: 'button', 'aria-label': t('common.share'), onclick: async () => {
              addDeed('dua', { once: 'dua-share' });
              const r = await shareText({ title: pick(d.title), text: `${d.ar}\n\n${pick(d.t)}\n(${pick(d.source)})\n\n— Tarikh` });
              if (r === 'copied') toast(t('share.copied'));
            } }, '↗'))));
      }
    };
    paint();
  });
}
