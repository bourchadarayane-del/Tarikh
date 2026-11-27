// (Ré)génère les récits des prophètes avec l'API Anthropic, puis les fait relire par un second appel de contrôle.
// Les 25 récits livrés dans content/premium/prophets/ ont déjà été rédigés et relus : ce script sert seulement
// à en régénérer un ou à ajouter une langue. Rien n'est écrit si le contrôle qualité échoue.
// Usage : node scripts/generate-prophets.js <langue> [slug]     (ANTHROPIC_KEY dans .env.local)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadEnv } from './env.mjs';
import { callClaude, parseJson, wordCount, LANG_NAMES } from '../api/_lib/anthropic.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
loadEnv(root);
const [lang, only] = process.argv.slice(2);
if (!LANG_NAMES[lang]) { console.error('Usage : node scripts/generate-prophets.js <fr|en|ar|es|id|ur> [slug]'); process.exit(1); }
if (!process.env.ANTHROPIC_KEY) { console.error('ANTHROPIC_KEY manquant (.env.local).'); process.exit(1); }

const file = path.join(root, 'content/premium/prophets', `${lang}.json`);
const reference = JSON.parse(fs.readFileSync(path.join(root, 'content/premium/prophets/en.json'), 'utf8'));
const current = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : [];
const RULES = `Write for a daily Islamic-history app. Base the story ONLY on the Qur'an and sound hadith. No isra'iliyyat presented as fact, no physical description of prophets, no polemics against other religions, no invented quotation. Say honestly when the Qur'an gives few details. Language: ${LANG_NAMES[lang]}. 300-500 words, paragraphs separated by \\n\\n, no markdown.`;

for (const ref of reference) {
  if (only && ref.slug !== only) continue;
  let done = false;
  for (let attempt = 1; attempt <= 3 && !done; attempt++) {
    try {
      const draft = parseJson(await callClaude({ system: RULES, maxTokens: 2500, user: `Write the story of the prophet "${ref.name}" (${ref.name_ar}). Use only these Qur'an references: ${ref.refs.join(', ')}. Return ONLY JSON: {"name":"","title":"","story":"","lesson":""}` }));
      const n = wordCount(draft.story);
      if (n < 280 || n > 520) throw new Error(`longueur ${n}`);
      const check = parseJson(await callClaude({ system: 'You are a strict reviewer of Islamic educational content. Reject on any doubt.', temperature: 0, maxTokens: 800, user: `Check this story about ${ref.name}: every statement must rest on the Qur'an (${ref.refs.join(', ')}) or sound hadith; no legend as fact; respectful; no sectarian content.\n\n${draft.story}\n\nReturn ONLY JSON: {"verdict":"pass" or "fail","issues":[]}` }));
      if (check.verdict !== 'pass') throw new Error(`contrôle : ${(check.issues || []).join(' | ')}`);
      const entry = { slug: ref.slug, ord: ref.ord, name: draft.name, name_ar: ref.name_ar, title: draft.title, story: draft.story, lesson: draft.lesson, refs: ref.refs };
      const i = current.findIndex((p) => p.slug === ref.slug);
      if (i >= 0) current[i] = entry; else current.push(entry);
      current.sort((a, b) => a.ord - b.ord);
      fs.writeFileSync(file, JSON.stringify(current, null, 2) + '\n');
      console.log(`ok ${ref.slug} (${n} mots)`);
      done = true;
    } catch (err) { console.error(`essai ${attempt} ${ref.slug} : ${err.message}`); }
  }
  if (!done) console.error(`ABANDON ${ref.slug} : récit existant conservé.`);
}
console.log('Terminé. Relisez le résultat, puis : node scripts/build-seed.mjs');
