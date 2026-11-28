// Tasbih : séries de 33 / 99 / 100 / libre, vibration, total du jour et cumulé.
import { t } from '../i18n.js';
import { h } from '../ui.js';
import { store, addDaily, getDaily, getTotal } from '../store.js';
import { hapticTap, hapticSuccess } from '../native.js';
import { addDeed } from '../deeds.js';

const DHIKR = [
  { id: 'subhanallah', ar: 'سُبْحَانَ اللَّهِ', tr: 'Subhan Allah' },
  { id: 'alhamdulillah', ar: 'الْحَمْدُ لِلَّهِ', tr: 'Al-hamdu lillah' },
  { id: 'allahuakbar', ar: 'اللَّهُ أَكْبَرُ', tr: 'Allahu akbar' },
  { id: 'lailaha', ar: 'لَا إِلَٰهَ إِلَّا اللَّهُ', tr: 'La ilaha illa Allah' },
  { id: 'astaghfirullah', ar: 'أَسْتَغْفِرُ اللَّهَ', tr: 'Astaghfirullah' },
  { id: 'salawat', ar: 'اللَّهُمَّ صَلِّ عَلَى مُحَمَّدٍ', tr: 'Allahumma salli ala Muhammad' },
];
const TARGETS = [33, 99, 100, 0];

export function render(body) {
  const st = { dhikr: 'subhanallah', target: 33, count: 0, ...store.get('tasbih', {}) };
  const save = () => store.set('tasbih', st);
  const count = h('span.tasbih-count', { 'aria-live': 'polite' }, String(st.count));
  const goal = h('span.muted');
  const arabic = h('p.arabic.center', { lang: 'ar' });
  const translit = h('p.translit.center');
  const today = h('b'), total = h('b');
  const paint = () => {
    const d = DHIKR.find((x) => x.id === st.dhikr) || DHIKR[0];
    arabic.textContent = d.ar; translit.textContent = d.tr;
    count.textContent = String(st.count);
    goal.textContent = st.target ? `/ ${st.target}` : t('tasbih.free');
    today.textContent = String(getDaily('tasbih')); total.textContent = String(getTotal('tasbih'));
  };
  const tap = h('button.tasbih-btn', { type: 'button', id: 'tasbih-tap', 'aria-label': t('tasbih.tap'), onclick: () => {
    st.count += 1; addDaily('tasbih', 1);
    if (st.target && st.count >= st.target) { hapticSuccess(); addDeed('dhikr'); st.count = 0; save(); paint(); count.textContent = '✓'; return; }
    hapticTap(); save(); paint();
  } }, count, goal);
  const seg = h('div.seg', { role: 'group', 'aria-label': t('tasbih.series') }, TARGETS.map((n) => h('button', { type: 'button', 'aria-pressed': String(st.target === n), onclick: (e) => {
    st.target = n; st.count = 0; save();
    seg.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', 'false'));
    e.currentTarget.setAttribute('aria-pressed', 'true'); paint();
  } }, n ? String(n) : t('tasbih.free'))));
  const select = h('select.input', { 'aria-label': t('tasbih.choose'), onchange: (e) => { st.dhikr = e.target.value; st.count = 0; save(); paint(); } },
    DHIKR.map((d) => h('option', { value: d.id, selected: d.id === st.dhikr }, d.tr)));
  body.append(h('div.tasbih-wrap', arabic, translit, tap, seg, select,
    h('div.stats', { style: 'width:100%' }, h('div.stat', today, h('span', t('tasbih.today'))), h('div.stat', total, h('span', t('tasbih.total'))),
      h('div.stat', h('button.btn.small.ghost', { type: 'button', onclick: () => { st.count = 0; save(); paint(); } }, t('common.reset'))))));
  paint();
}
