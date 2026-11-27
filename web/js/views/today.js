// Onglet « Aujourd'hui » : série, jeûne, horaires de prière, rappel, histoire du jour, outils.
import { t, fmtDate, fmtTime, hijriLabel, pick, dir } from '../i18n.js';
import { store, touchStreak, getDaily } from '../store.js';
import { h, clear, toast, loadData } from '../ui.js';
import { toHijri, fastingInfo } from '../hijri.js';
import { addDays } from '../store.js';
import { PRAYERS, prayerTimes, nextPrayer, formatCountdown } from '../prayer.js';
import { getStory, getReminder } from '../content.js';
import { getLocation, locationPicker } from '../location.js';
import { openSheet, closeSheet } from '../ui.js';
import { TOOLS, LINKS, toolLocked } from '../tools/index.js';
import { openStory } from './story.js';
import { shareText } from '../native.js';
import { addDeed } from '../deeds.js';

let timer = null;
let listening = false;
export function stopToday() { clearInterval(timer); timer = null; }

const settings = () => ({ method: 'mwl', asr: 'standard', hijriAdjust: 0, ...store.get('settings', {}) });

export function openLocationSheet() {
  openSheet({ title: t('location.title'), render: (body) => body.append(locationPicker(() => { closeSheet(); toast(t('location.saved')); })) });
}

function streakCard() {
  const s = touchStreak();
  return h('div.card.streak', { 'aria-label': t('streak.aria', { n: s.count }) },
    h('span.streak-num', { 'aria-hidden': 'true' }, '🔥 ' + s.count),
    h('div.grow', h('p', h('b', t(s.count > 1 ? 'streak.days' : 'streak.day', { n: s.count }))), h('p.muted', t('streak.best', { n: s.best || s.count }))),
    h('div.center', h('b.gold', String(getDaily('deeds'))), h('p.muted', t('deeds.today'))));
}

function fastingCard(days) {
  const s = settings();
  const today = fastingInfo(new Date(), s.hijriAdjust);
  const tomorrow = fastingInfo(addDays(new Date(), 1), s.hijriAdjust);
  const special = (info) => days.find((d) => d.month === info.h.m && info.h.d >= d.day && info.h.d <= (d.endDay || d.day));
  const out = [];
  const sp = special(today);
  if (sp) out.push(h('div.alert.gold', { role: 'note' }, h('span', { 'aria-hidden': 'true' }, '★'), h('div', h('b', pick(sp.title)), h('p', pick(sp.short)))));
  if (today.ramadan) out.push(h('div.alert', { role: 'note' }, h('span', { 'aria-hidden': 'true' }, '🌙'), h('div', h('b', t('fast.ramadan', { n: today.h.d })))));
  else if (today.forbidden) out.push(h('div.alert.gold', { role: 'note' }, h('span', { 'aria-hidden': 'true' }, '☼'), h('div', t('fast.forbidden'))));
  else if (today.recommended) out.push(h('div.alert', { role: 'note' }, h('span', { 'aria-hidden': 'true' }, '🌿'), h('div', h('b', t('fast.today')), h('p', today.reasons.map((r) => t('fast.reason.' + r)).join(' · ')))));
  else if (tomorrow.recommended) out.push(h('div.alert', { role: 'note' }, h('span', { 'aria-hidden': 'true' }, '🌿'), h('div', h('b', t('fast.tomorrow')), h('p', tomorrow.reasons.map((r) => t('fast.reason.' + r)).join(' · ')))));
  return out;
}

function prayerCard() {
  const loc = getLocation();
  const card = h('section.card', { id: 'prayer-card', 'aria-label': t('prayer.title') });
  if (!loc) {
    card.append(h('p.label', t('prayer.title')), h('p', { style: 'margin:8px 0 12px' }, t('prayer.needLocation')),
      h('button.btn.primary.block', { type: 'button', id: 'btn-set-location', onclick: openLocationSheet }, t('location.choose')));
    return card;
  }
  const s = settings();
  const now = new Date();
  const times = prayerTimes(loc.lat, loc.lon, now, s.method, s.asr);
  const next = nextPrayer(loc.lat, loc.lon, now, s.method, s.asr);
  const count = h('div.countdown', { id: 'prayer-countdown', 'aria-live': 'off' }, formatCountdown(next.time - now));
  card.append(
    h('div.row.between', h('p.label', t('prayer.title')),
      h('button.chip', { type: 'button', onclick: openLocationSheet, 'aria-label': t('location.change') }, '📍 ', loc.name)),
    h('div.row.between', { style: 'margin-top:10px' },
      h('div', h('p.muted', t('prayer.next')), h('p.title.small', { id: 'prayer-next-name' }, t('prayer.' + next.name))), count),
    h('ul.prayer-list', PRAYERS.map((name) => h('li.prayer-row' + (name === next.name && next.time.getDate() === now.getDate() ? '.next' : times[name] < now ? '.past' : ''),
      { dataset: { prayer: name } }, h('span', t('prayer.' + name)), h('span.ltr', fmtTime(times[name]))))),
    h('p.muted', { style: 'margin-top:8px' }, t('prayer.method', { method: t('method.' + s.method) })),
  );
  clearInterval(timer);
  timer = setInterval(() => {
    const el = document.getElementById('prayer-countdown');
    if (!el) { stopToday(); return; }
    const left = next.time - new Date();
    if (left <= 0) { const fresh = prayerCard(); document.getElementById('prayer-card')?.replaceWith(fresh); return; }
    el.textContent = formatCountdown(left);
  }, 1000);
  return card;
}

function reminderCard(r) {
  return h('section.card', { 'aria-label': t('reminder.label') },
    h('p.label', t('reminder.label')),
    r.arabic ? h('p.arabic', { lang: 'ar' }, r.arabic) : null,
    h('p.quote', { style: 'margin-top:8px' }, '« ' + r.text + ' »'),
    h('p.muted', { style: 'margin-top:8px' }, [r.narrator, r.source].filter(Boolean).join(' — ')),
    h('div.actions', h('button.btn.small.ghost', { type: 'button', onclick: async () => {
      addDeed('reminder', { once: 'reminder-share' });
      const res = await shareText({ title: t('reminder.label'), text: `${r.arabic ? r.arabic + '\n\n' : ''}« ${r.text} »\n${r.source}\n\n— Tarikh` });
      if (res === 'copied') toast(t('share.copied'));
    } }, '↗ ', t('common.share'))));
}

function storyCard(s) {
  return h('section.card.gold-border', { id: 'story-card', 'aria-label': t('story.label') },
    h('p.label', t('story.label')),
    h('p.muted', { style: 'margin-top:6px' }, [s.era, s.period].filter(Boolean).join(' · ')),
    h('h2.title', s.title),
    h('p.quote', s.teaser || String(s.story).split(/\n/)[0]),
    h('div.actions', h('button.btn.primary', { type: 'button', id: 'btn-read-story', onclick: () => openStory(s, { today: true }) }, t('story.read'), dir() === 'rtl' ? ' ←' : ' →')),
    s.origin === 'last' ? h('p.muted', { style: 'margin-top:8px' }, t('story.offline')) : null);
}

function toolsGrid() {
  const order = ['tasbih', 'qibla', 'names', 'duas', 'adhkar', 'deeds', 'prayers', 'fasting', 'zakat', 'ramadan', 'prophets', 'hajj', 'quiz'];
  const tiles = order.map((name) => h('a.tile', { href: `#/tool/${name}`, dataset: { tool: name } },
    toolLocked(name) ? h('span.badge-lock', { 'aria-label': 'Premium' }, '✦') : null,
    h('span.tile-ico', { 'aria-hidden': 'true' }, TOOLS[name].ico), h('span', t(`tool.${name}`))));
  for (const [name, link] of Object.entries(LINKS)) {
    tiles.push(h('button.tile', { type: 'button', dataset: { link: name }, onclick: link.open }, h('span.tile-ico', { 'aria-hidden': 'true' }, link.ico), h('span', t(`tool.${name}`))));
  }
  return h('section', { 'aria-label': t('tools.title') }, h('p.label.section-title', t('tools.title')), h('div.grid', tiles));
}

const skeleton = (label) => h('section.card', { 'aria-busy': 'true' }, h('p.label', label), h('div.skeleton', { style: 'width:70%;height:22px' }), h('div.skeleton'), h('div.skeleton', { style: 'width:85%' }));

export async function renderToday(root) {
  if (!listening) {
    listening = true;
    const again = () => { if (document.body.dataset.tab === 'today') renderToday(document.getElementById('view-today')); };
    document.addEventListener('tarikh:location', again);
    document.addEventListener('tarikh:deeds', () => { const el = document.querySelector('#view-today .streak'); if (el) el.replaceWith(streakCard()); });
    document.addEventListener('tarikh:settings', again);
  }
  const s = settings();
  const now = new Date();
  const reminderSlot = skeleton(t('reminder.label'));
  const storySlot = skeleton(t('story.label'));
  const fastSlot = h('div.stack');
  clear(root).append(
    h('div', h('h1.title', { style: 'margin:0' }, fmtDate(now)), h('p.gold', hijriLabel(toHijri(now, s.hijriAdjust)))),
    streakCard(), fastSlot, prayerCard(), reminderSlot, storySlot, toolsGrid(),
    h('p.muted.center', t('ai.notice')),
  );
  loadData('days').then((days) => fastSlot.append(...fastingCard(days))).catch(() => fastSlot.append(...fastingCard([])));
  getReminder(now).then((r) => reminderSlot.replaceWith(reminderCard(r)))
    .catch(() => reminderSlot.replaceWith(h('section.card', h('p.label', t('reminder.label')), h('p.muted', t('common.error')))));
  getStory(now).then((st) => storySlot.replaceWith(storyCard(st)))
    .catch(() => storySlot.replaceWith(h('section.card', h('p.label', t('story.label')), h('p.muted', t('story.unavailable')),
      h('button.btn.ghost.small', { type: 'button', onclick: () => renderToday(root) }, t('common.retry')))));
}
