// Calculateur de zakat : nisab (or 85 g ou argent 595 g), hawl (année lunaire), 2,5 %.
import { t, fmtNum } from '../i18n.js';
import { h } from '../ui.js';
import { store } from '../store.js';
import { addDeed } from '../deeds.js';

const FIELDS = ['cash', 'gold', 'silver', 'invest', 'trade', 'owed', 'debts'];
export function render(body) {
  const st = { basis: 'gold', price: '', hawl: true, ...store.get('zakat', {}) };
  const num = (v) => { const n = parseFloat(String(v ?? '').replace(',', '.')); return Number.isFinite(n) && n > 0 ? n : 0; };
  const result = h('div.price-box', { 'aria-live': 'polite' });
  const compute = () => {
    store.set('zakat', st);
    const assets = ['cash', 'gold', 'silver', 'invest', 'trade', 'owed'].reduce((s, k) => s + num(st[k]), 0);
    const net = Math.max(0, assets - num(st.debts));
    const nisab = num(st.price) * (st.basis === 'gold' ? 85 : 595);
    result.replaceChildren();
    if (!num(st.price)) { result.append(h('p.muted', t('zakat.needPrice'))); return; }
    const due = st.hawl && net >= nisab;
    result.append(h('p.label', t('zakat.result')), h('p.price', { id: 'zakat-due' }, fmtNum(due ? net * 0.025 : 0, { maximumFractionDigits: 2 })),
      h('p.muted', t('zakat.net', { net: fmtNum(net, { maximumFractionDigits: 2 }), nisab: fmtNum(nisab, { maximumFractionDigits: 2 }) })),
      h('p', { style: 'margin-top:6px' }, due ? t('zakat.due') : !st.hawl ? t('zakat.noHawl') : t('zakat.below')));
    if (due) addDeed('zakat', { once: 'zakat' });
  };
  const field = (key) => h('label.field', h('span', t('zakat.f.' + key)), h('input.input', { type: 'text', inputmode: 'decimal', value: st[key] ?? '', dataset: { z: key }, oninput: (e) => { st[key] = e.target.value; compute(); } }));
  const seg = h('div.seg', { role: 'group', 'aria-label': t('zakat.basis') }, ['gold', 'silver'].map((b) => h('button', { type: 'button', 'aria-pressed': String(st.basis === b), onclick: (e) => {
    st.basis = b; seg.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', 'false')); e.currentTarget.setAttribute('aria-pressed', 'true'); compute();
  } }, t('zakat.basis.' + b))));
  body.append(h('p.muted', t('zakat.intro')),
    h('div.card.stack', h('p.label', t('zakat.nisab')), seg, field('price'),
      h('label.switch-row', h('span', t('zakat.hawl')), h('input.switch', { type: 'checkbox', checked: st.hawl, onchange: (e) => { st.hawl = e.target.checked; compute(); } }))),
    h('div.card.stack', h('p.label', t('zakat.assets')), FIELDS.map(field)),
    result, h('p.muted', t('zakat.disclaimer')));
  compute();
}
