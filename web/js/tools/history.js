// Historique et favoris. Gratuit : 3 dernières histoires lues. Premium : historique complet + favoris illimités.
import { t, fmtDate, lang } from '../i18n.js';
import { h, clear, loading } from '../ui.js';
import { isPremium, getPremiumContent } from '../premium.js';
import { localHistory, favorites } from '../content.js';
import { premiumCta } from './common.js';
import { parseDateKey } from '../store.js';

const row = (s, onOpen) => h('li', h('button.list-item', { type: 'button', onclick: () => onOpen(s) },
  h('span.grow', h('b', s.title), h('p.muted', [s.date ? fmtDate(parseDateKey(s.date), { day: 'numeric', month: 'long', year: 'numeric' }) : '', s.era].filter(Boolean).join(' · ')))));

export function render(body, mode = 'history') {
  const open = async (s) => { const { openStory } = await import('../views/story.js'); openStory(s); };
  const paint = async () => {
    clear(body);
    const seg = h('div.seg', { role: 'group' }, ['history', 'favorites'].map((m) => h('button', { type: 'button', 'aria-pressed': String(m === mode), onclick: () => { mode = m; paint(); } }, t('history.tab.' + m))));
    body.append(seg);
    if (mode === 'favorites') {
      if (!isPremium()) { body.append(premiumCta('favorites.locked')); return; }
      const favs = favorites();
      body.append(favs.length ? h('ul.list', favs.map((s) => row(s, open))) : h('p.muted.center', t('favorites.empty')));
      return;
    }
    const local = localHistory().filter((s) => s.lang === lang());
    if (!isPremium()) {
      body.append(local.length ? h('ul.list', local.slice(0, 3).map((s) => row(s, open))) : h('p.muted.center', t('history.empty')), premiumCta('history.locked'));
      return;
    }
    const slot = loading();
    body.append(slot);
    let list = local;
    try {
      const remote = await getPremiumContent('history');
      const seen = new Set(remote.map((s) => s.date));
      list = [...remote, ...local.filter((s) => !seen.has(s.date))].sort((a, b) => String(b.date).localeCompare(String(a.date)));
    } catch { /* hors-ligne : historique local */ }
    slot.replaceWith(list.length ? h('ul.list', list.map((s) => row(s, open))) : h('p.muted.center', t('history.empty')));
  };
  paint();
}
