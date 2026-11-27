// Prophètes (Premium) : 25 récits, références coraniques, progression x/25. Le premier récit est offert en aperçu.
import { t, lang } from '../i18n.js';
import { h, clear, loading, errorBox, paragraphs } from '../ui.js';
import { store } from '../store.js';
import { isPremium, getPremiumContent } from '../premium.js';
import { premiumCta, premiumIndex } from './common.js';
import { addDeed } from '../deeds.js';

export function render(body) {
  const list = async () => {
    clear(body).append(loading());
    let index;
    try { index = await premiumIndex(lang()); } catch { clear(body).append(errorBox(list)); return; }
    const read = store.get('prophetsRead', []);
    clear(body);
    body.append(
      h('div.row.between', h('p.label', t('prophets.progress', { n: read.length, total: index.prophets.length })), isPremium() ? null : h('span.badge-lock', '✦ Premium')),
      h('div.progress', h('span', { style: `width:${(read.length / index.prophets.length) * 100}%` })),
      h('ul.list', index.prophets.map((p, i) => {
        const free = i === 0;
        return h('li', h('button.list-item' + (read.includes(p.slug) ? '.done' : ''), { type: 'button', dataset: { prophet: p.slug }, onclick: () => open(p, index, free) },
          h('span.list-num', read.includes(p.slug) ? '✓' : String(i + 1)),
          h('span.grow', h('b', p.name), h('p.muted', p.title)),
          h('span.name-ar', { lang: 'ar', style: 'font-size:1.2rem' }, p.name_ar),
          !isPremium() ? h('span.badge-lock', free ? t('premium.free') : '✦') : null));
      })),
      isPremium() ? null : premiumCta('prophets.locked'));
  };
  const open = async (p, index, free) => {
    if (!isPremium() && !free) { location.hash = '#/paywall'; return; }
    clear(body).append(loading());
    let story;
    try { story = isPremium() ? (await getPremiumContent('prophets')).find((x) => x.slug === p.slug) : index.sample; }
    catch (err) { clear(body).append(err.status === 402 ? premiumCta('prophets.locked') : errorBox(() => open(p, index, free))); return; }
    if (!story) { list(); return; }
    const read = store.get('prophetsRead', []);
    if (!read.includes(story.slug)) { read.push(story.slug); store.set('prophetsRead', read); addDeed('prophet'); }
    clear(body);
    body.scrollTop = 0;
    body.append(h('button.btn.small.ghost', { type: 'button', style: 'align-self:flex-start', onclick: list }, '‹ ', t('common.back')),
      h('article.stack', h('p.arabic.center', { lang: 'ar' }, story.name_ar), h('h3.title.center', story.name), h('p.label.center', story.title),
        h('div.story-text', paragraphs(story.story)),
        h('div.lesson', h('p.label', t('story.lesson')), h('p.quote', story.lesson)),
        h('div', h('p.label', t('prophets.refs')), h('div.row.wrap', { style: 'margin-top:8px' }, (story.refs || []).map((r) => h('span.chip.ltr', r))))),
      isPremium() ? null : premiumCta('prophets.locked'));
  };
  list();
}
