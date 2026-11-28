// Contenus : structure identique dans les 6 langues, volumes attendus, aucune coquille vide.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const LANGS = ['fr', 'en', 'ar', 'es', 'id', 'ur'];
const read = (p) => JSON.parse(fs.readFileSync(new URL(`../${p}`, import.meta.url), 'utf8'));
const six = (o, where) => { for (const l of LANGS) assert.ok(typeof o?.[l] === 'string' && o[l].trim(), `${where} : langue ${l} manquante`); };
const words = (s) => s.trim().split(/\s+/).length;

test('99 Noms, jours symboliques, hadiths, douaas, adhkar', () => {
  const names = read('web/data/names99.json');
  assert.equal(names.length, 99); names.forEach((n, i) => { assert.equal(n.n, i + 1); assert.ok(n.ar && n.tr); six(n.m, `nom ${n.n}`); });
  const days = read('web/data/days.json');
  assert.ok(days.length >= 15); days.forEach((d) => { six(d.title, d.id); six(d.short, d.id); assert.ok(d.month >= 1 && d.month <= 12); });
  for (const id of ['new-year', 'tasua', 'ashura', 'mawlid', 'isra-miraj', 'mid-shaban', 'ramadan-start', 'last-ten-nights', 'laylat-al-qadr', 'eid-al-fitr', 'six-shawwal', 'dhul-hijja-nine', 'arafat', 'eid-al-adha', 'tashriq']) assert.ok(days.some((d) => d.id === id), `jour ${id}`);
  const hadiths = read('web/data/hadiths.json');
  assert.ok(hadiths.length >= 30); hadiths.forEach((h) => { assert.ok(h.ar && ['bukhari', 'muslim'].includes(h.collection)); six(h.t, h.id); six(h.ref, h.id); });
  const duas = read('web/data/duas.json');
  assert.ok(duas.length >= 30); duas.forEach((d) => { assert.ok(d.ar && d.tr); six(d.t, d.id); six(d.title, d.id); six(d.source, d.id); });
  const adhkar = read('web/data/adhkar.json');
  for (const s of ['after-prayer', 'morning', 'evening', 'sleep']) { assert.ok(adhkar[s].length >= 4, s); adhkar[s].forEach((a) => { assert.ok(a.ar && a.count >= 1); six(a.t, a.id); }); }
});

test('Histoires : même bibliothèque dans les 6 langues, longues, aucun doublon', () => {
  const en = read('content/stories/en.json');
  assert.ok(en.length >= 30); assert.equal(new Set(en.map((s) => s.topic_key)).size, en.length);
  // Au moins un tiers d'histoires de conflit (batailles, résistance, épisodes récents).
  assert.ok(en.filter((s) => ['battles', 'resistance', 'modern'].includes(s.category)).length >= Math.floor(en.length / 4), 'pas assez d\'histoires de conflit');
  for (const l of LANGS) {
    const list = read(`content/stories/${l}.json`);
    assert.deepEqual(list.map((s) => s.topic_key), en.map((s) => s.topic_key), l);
    for (const s of list) { for (const k of ['title', 'era', 'period', 'teaser', 'story', 'lesson']) assert.ok(s[k]?.trim(), `${l} ${s.topic_key} ${k}`); assert.ok(words(s.story) >= (l === 'ur' || l === 'ar' ? 220 : 260), `${l} ${s.topic_key} trop court : ${words(s.story)} mots`); assert.ok(!/[<>*#]/.test(s.story), `${l} ${s.topic_key} balisage`); }
  }
  // Garde-fou contre l'erreur historique déjà rencontrée : al-Idrisi n'était pas aveugle.
  const idrisi = en.find((s) => s.topic_key.includes('idrisi'));
  assert.ok(idrisi && !/\bblind\b/i.test(idrisi.story + idrisi.teaser));
});

test('Premium : 25 prophètes (300-500 mots), guide Hajj, 120 questions, détail des jours — 6 langues', () => {
  const pEn = read('content/premium/prophets/en.json'), qEn = read('content/premium/quiz/en.json'), hEn = read('content/premium/hajj/en.json'), dEn = read('content/premium/days/en.json');
  assert.equal(pEn.length, 25); assert.equal(qEn.length, 120);
  for (const p of pEn) assert.ok(words(p.story) >= 300 && words(p.story) <= 500, `prophète ${p.slug} : ${words(p.story)} mots`);
  for (const l of LANGS) {
    const p = read(`content/premium/prophets/${l}.json`);
    assert.deepEqual(p.map((x) => [x.slug, x.ord, x.refs.join()]), pEn.map((x) => [x.slug, x.ord, x.refs.join()]), `prophètes ${l}`);
    p.forEach((x) => { assert.ok(x.name && x.title && x.lesson && words(x.story) >= 200, `${l} ${x.slug}`); x.refs.forEach((r) => assert.match(r, /^\d{1,3}:\d{1,3}(-\d{1,3})?$/)); });
    const q = read(`content/premium/quiz/${l}.json`);
    assert.deepEqual(q.map((x) => [x.id, x.cat, x.answer]), qEn.map((x) => [x.id, x.cat, x.answer]), `quiz ${l}`);
    q.forEach((x) => { assert.equal(x.options.length, 4); assert.equal(new Set(x.options).size, 4, `${l} ${x.id} options en double`); assert.ok(x.q && x.explain && x.answer >= 0 && x.answer <= 3); });
    const h = read(`content/premium/hajj/${l}.json`);
    for (const part of ['umrah', 'hajj']) { assert.deepEqual(h[part].chapters.map((c) => c.id), hEn[part].chapters.map((c) => c.id), `hajj ${l}`); h[part].chapters.forEach((c) => assert.ok(c.title && c.body && c.steps.length >= 3)); }
    assert.equal(h.mistakes.length, hEn.mistakes.length); assert.deepEqual(h.checklist.map((c) => c.id), hEn.checklist.map((c) => c.id));
    const d = read(`content/premium/days/${l}.json`);
    assert.deepEqual(Object.keys(d), Object.keys(dEn), `jours ${l}`); Object.values(d).forEach((x) => assert.ok(x.detail && Array.isArray(x.sources)));
  }
  assert.deepEqual(Object.keys(dEn).sort(), read('web/data/days.json').map((d) => d.id).sort());
});
