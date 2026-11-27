// Les 99 Noms d'Allah : arabe, translittération, sens, recherche.
import { t, pick } from '../i18n.js';
import { h, clear, loadData } from '../ui.js';

const norm = (s) => String(s).normalize('NFD').replace(/[̀-ًͯ-ْٰ]/g, '').toLowerCase();
export function render(body) {
  const list = h('div.stack');
  const input = h('input.input', { type: 'search', placeholder: t('names.searchPh'), 'aria-label': t('names.search') });
  body.append(h('p.muted', t('names.intro')), input, list);
  loadData('names99').then((names) => {
    const paint = () => {
      const q = norm(input.value.trim());
      clear(list);
      const found = names.filter((n) => !q || norm(n.tr).includes(q) || norm(pick(n.m)).includes(q) || norm(n.ar).includes(q) || String(n.n) === q);
      if (!found.length) list.append(h('p.muted.center', t('common.noResult')));
      for (const n of found) {
        list.append(h('div.name-card', h('span.list-num', String(n.n)), h('div', h('b', n.tr), h('p.muted', pick(n.m))), h('span.name-ar', { lang: 'ar' }, n.ar)));
      }
    };
    input.addEventListener('input', paint);
    paint();
  });
}
