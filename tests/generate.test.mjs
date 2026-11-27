// Génération IA : JSON strict, contrôle qualité, anti-doublon, repli sur la bibliothèque.
import test from 'node:test';
import assert from 'node:assert/strict';
import { generateDailyStory, parseJson, validateStory, slugify, LANGS } from '../api/_lib/anthropic.js';
import { ensureDay, reminderRows, dayNumber } from '../api/_lib/daily.js';
import { fakeDb } from './helpers/fakedb.mjs';

const body = Array.from({ length: 4 }, (_, i) => `Paragraph ${i + 1} ` + 'word '.repeat(48)).join('\n\n');
const draft = (key = 'al-khwarizmi-algebra') => JSON.stringify({ topic_key: key, title: 'A title', era: '9th century', period: 'Abbasid Caliphate', teaser: 'A teaser.', story: body, lesson: 'A lesson.', claims: ['c1'] });
const translation = JSON.stringify({ title: 'T', era: 'E', period: 'P', teaser: 'Te', story: 'a\n\nb\n\nc\n\nd', lesson: 'L' });
function fakeCall({ verdicts = ['pass'], keys = [] } = {}) {
  const calls = { draft: 0, check: 0, translate: 0 };
  const fn = async ({ system, user }) => {
    if (/fact-checker/.test(system)) return `Here: {"verdict":"${verdicts[Math.min(calls.check++, verdicts.length - 1)]}","issues":${verdicts[calls.check - 1] === 'fail' ? '["doubtful date"]' : '[]'}}`;
    if (/translator/.test(system)) { calls.translate++; return '```json\n' + translation + '\n```'; }
    assert.match(user, /already-published/);
    return draft(keys[calls.draft++] || 'al-khwarizmi-algebra');
  };
  fn.calls = calls;
  return fn;
}

test('parseJson / validateStory / slugify', () => {
  assert.deepEqual(parseJson('text {"a":1} more'), { a: 1 });
  assert.throws(() => parseJson('no json'));
  assert.throws(() => validateStory({ title: 'x' }));
  assert.throws(() => validateStory({ ...JSON.parse(draft()), story: 'too short' }, { canonical: true }));
  assert.throws(() => validateStory({ ...JSON.parse(draft()), story: body + ' <b>x</b>' }, { canonical: true }));
  assert.equal(slugify('Fāṭima al-Fihrī & Qarawiyyin!'), 'fatima-al-fihri-qarawiyyin');
});

test('Histoire acceptée : même sujet dans les 6 langues', async () => {
  const call = fakeCall();
  const out = await generateDailyStory({ category: 'sciences', usedTopics: [], call });
  assert.equal(out.topic_key, 'al-khwarizmi-algebra'); assert.deepEqual(Object.keys(out.stories).sort(), [...LANGS].sort());
  assert.equal(call.calls.translate, 5); assert.equal(out.stories.en.claims, undefined);
});

test('Contrôle qualité : rejet puis nouvel essai ; échec après 3 essais', async () => {
  const call = fakeCall({ verdicts: ['fail', 'pass'], keys: ['topic-one', 'topic-two'] });
  const out = await generateDailyStory({ category: 'art', call });
  assert.equal(out.attempts, 2); assert.equal(out.topic_key, 'topic-two');
  await assert.rejects(generateDailyStory({ category: 'art', call: fakeCall({ verdicts: ['fail'] }) }), /generation_failed/);
});

test('Anti-doublon : un sujet déjà publié est refusé', async () => {
  await assert.rejects(generateDailyStory({ category: 'sciences', usedTopics: ['al-khwarizmi-algebra'], call: fakeCall() }), /duplicate_topic/);
});

test('ensureDay : IA si la clé existe, sinon bibliothèque ; jamais deux fois le même sujet', async () => {
  const db = fakeDb();
  delete process.env.ANTHROPIC_KEY;
  const a = await ensureDay('2026-12-01', { db });
  const b = await ensureDay('2026-12-02', { db });
  assert.equal(a.story, 'seed'); assert.equal(b.story, 'seed'); assert.notEqual(a.topic_key, b.topic_key);
  assert.equal((await ensureDay('2026-12-01', { db })).story, 'exists');
  process.env.ANTHROPIC_KEY = 'test-key-not-real';
  const c = await ensureDay('2026-12-03', { db, call: fakeCall({ keys: ['brand-new-topic'] }) });
  assert.equal(c.story, 'ai'); assert.equal(db.state.stories.filter((s) => s.date === '2026-12-03').length, 6);
  // Si l'IA échoue (contrôle qualité), on publie quand même une histoire relue de la bibliothèque.
  const d = await ensureDay('2026-12-04', { db, call: fakeCall({ verdicts: ['fail'] }) });
  assert.equal(d.story, 'seed');
  delete process.env.ANTHROPIC_KEY;
  assert.equal(new Set(db.state.topics.map((t) => t.topic_key)).size, 4);
});

test('Rappel du jour : même hadith que l\'application pour une date donnée', async () => {
  const pool = (await import('../web/data/hadiths.json', { with: { type: 'json' } })).default;
  const rows = reminderRows('2026-12-01');
  assert.equal(rows.length, 6);
  assert.equal(rows[0].hadith_id, pool[dayNumber('2026-12-01') % pool.length].id);
  assert.ok(rows.every((r) => r.text && r.source && r.arabic));
});
