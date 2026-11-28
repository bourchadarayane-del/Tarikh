// Adhkar : après la prière, matin, soir, sommeil — avec compteurs remis à zéro chaque jour.
import { t, pick } from '../i18n.js';
import { h, clear, loadData } from '../ui.js';
import { store, dateKey } from '../store.js';
import { hapticTap, hapticSuccess } from '../native.js';
import { addDeed } from '../deeds.js';

const SECTIONS = ['after-prayer', 'morning', 'evening', 'sleep'];
export function render(body) {
  const hour = new Date().getHours();
  let section = hour < 11 ? 'morning' : hour >= 21 ? 'sleep' : hour >= 16 ? 'evening' : 'after-prayer';
  const seg = h('div.seg', { role: 'group' });
  const list = h('div.stack');
  body.append(seg, list);
  loadData('adhkar').then((data) => {
    const key = () => `adhkar:${dateKey()}`;
    for (const k of store.keys('adhkar:')) if (k !== key()) store.del(k);
    const paint = () => {
      clear(seg);
      for (const s of SECTIONS) seg.append(h('button', { type: 'button', 'aria-pressed': String(s === section), onclick: () => { section = s; paint(); } }, t('adhkar.' + s)));
      clear(list);
      const progress = store.get(key(), {});
      for (const item of data[section] || []) {
        const id = `${section}/${item.id}`;
        const target = item.count || 1;
        const btn = h('button.counter-pill', { type: 'button' });
        const show = () => {
          const n = progress[id] || 0;
          btn.textContent = `${Math.min(n, target)} / ${target}`;
          btn.classList.toggle('done', n >= target);
          btn.setAttribute('aria-label', t('adhkar.count', { n: Math.min(n, target), total: target }));
        };
        btn.addEventListener('click', () => {
          const n = progress[id] || 0;
          if (n >= target) return;
          progress[id] = n + 1; store.set(key(), progress);
          if (progress[id] >= target) {
            hapticSuccess();
            const all = (data[section] || []).every((x) => (progress[`${section}/${x.id}`] || 0) >= (x.count || 1));
            if (all) addDeed('adhkar', { once: 'adhkar-' + section });
          } else hapticTap();
          show();
        });
        show();
        list.append(h('article.card', h('p.arabic', { lang: 'ar' }, item.ar), h('p.translit', item.tr), h('p', { style: 'margin-top:6px' }, pick(item.t)),
          h('div.row.between', { style: 'margin-top:10px' }, h('span.muted', pick(item.source)), btn)));
      }
    };
    paint();
  });
}
