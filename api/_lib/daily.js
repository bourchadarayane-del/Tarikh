// Passage quotidien : garantit une histoire et un rappel par jour et par langue (aujourd'hui et demain UTC).
// Ordre de priorité : IA vérifiée -> sinon histoire de la bibliothèque relue (jamais de jour vide).
import { LANGS, CATEGORIES, generateDailyStory, callClaude } from './anthropic.js';
import hadiths from '../../web/data/hadiths.json' with { type: 'json' };
import seedFr from '../../content/stories/fr.json' with { type: 'json' };
import seedEn from '../../content/stories/en.json' with { type: 'json' };
import seedAr from '../../content/stories/ar.json' with { type: 'json' };
import seedEs from '../../content/stories/es.json' with { type: 'json' };
import seedId from '../../content/stories/id.json' with { type: 'json' };
import seedUr from '../../content/stories/ur.json' with { type: 'json' };

const SEEDS = { fr: seedFr, en: seedEn, ar: seedAr, es: seedEs, id: seedId, ur: seedUr };
export const dayNumber = (date) => Math.floor(Date.parse(`${date}T00:00:00Z`) / 86400000);
export const isoDate = (d) => d.toISOString().slice(0, 10);
export const addDaysIso = (date, n) => isoDate(new Date(Date.parse(`${date}T00:00:00Z`) + n * 86400000));

// Même règle que l'application : le rappel du jour N est le hadith n° (N mod taille de la liste).
export function reminderRows(date, pool = hadiths) {
  const h = pool[((dayNumber(date) % pool.length) + pool.length) % pool.length];
  return LANGS.map((lang) => ({ date, lang, hadith_id: h.id, arabic: h.ar, text: h.t[lang] || h.t.en, narrator: h.narrator?.[lang] || h.narrator?.en || null, source: h.ref[lang] || h.ref.en }));
}

function seedStory(used, seeds = SEEDS) {
  const pick = seeds.en.find((s) => !used.has(s.topic_key));
  if (!pick) return null;
  const stories = {};
  for (const lang of LANGS) {
    const s = (seeds[lang] || []).find((x) => x.topic_key === pick.topic_key) || pick;
    stories[lang] = { title: s.title, era: s.era, period: s.period, teaser: s.teaser, story: s.story, lesson: s.lesson };
  }
  return { topic_key: pick.topic_key, category: pick.category, stories, origin: 'seed' };
}

export async function ensureDay(date, { db, call = callClaude, seeds = SEEDS, pool = hadiths, log = [] } = {}) {
  const out = { date, story: 'exists', reminder: 'exists' };
  if ((await db.remindersOn(date)).length < LANGS.length) { await db.saveReminders(reminderRows(date, pool)); out.reminder = 'created'; }
  const existing = await db.storiesOn(date);
  if (existing.length >= LANGS.length) return out;

  const topics = await db.usedTopics();
  // Les sujets de la bibliothèque non encore publiés restent disponibles pour le repli.
  const used = new Set(topics.filter((t) => t.origin !== 'seed' || t.published_on).map((t) => t.topic_key));
  const avoidForAi = topics.map((t) => t.topic_key);
  const category = CATEGORIES[((dayNumber(date) % CATEGORIES.length) + CATEGORIES.length) % CATEGORIES.length];
  let result = null;
  if (process.env.ANTHROPIC_KEY) {
    try { result = { ...(await generateDailyStory({ category, usedTopics: avoidForAi, call })), origin: 'ai' }; }
    catch (err) { log.push(`${date}: ${err.message}`); }
  } else log.push(`${date}: ANTHROPIC_KEY absent, histoire de la bibliothèque`);
  if (!result) result = seedStory(used, seeds);
  if (!result) { out.story = 'failed'; log.push(`${date}: bibliothèque épuisée`); return out; }

  await db.saveStories(LANGS.map((lang) => ({ date, lang, ...result.stories[lang], topic_key: result.topic_key, category: result.category, origin: result.origin })));
  await db.saveTopic({ topic_key: result.topic_key, category: result.category, title_en: result.stories.en.title, origin: result.origin, published_on: date });
  out.story = result.origin;
  out.topic_key = result.topic_key;
  return out;
}

export async function runDaily({ db, now = new Date(), call, notify, dates } = {}) {
  const today = isoDate(now);
  const log = [];
  const days = [];
  for (const date of dates || [today, addDaysIso(today, 1)]) days.push(await ensureDay(date, { db, call, log }));
  let push = { skipped: 'already_sent_or_disabled' };
  const run = await db.cronRun(today);
  if (notify && !run?.notified_at && days.every((d) => d.story !== 'failed')) {
    push = await notify();
    await db.saveCronRun({ date: today, stories: days.length, notified_at: push.skipped ? null : new Date().toISOString(), detail: { days, log, push } });
  } else {
    await db.saveCronRun({ date: today, stories: days.length, notified_at: run?.notified_at ?? null, detail: { days, log } });
  }
  return { ok: days.every((d) => d.story !== 'failed'), days, log, push };
}
