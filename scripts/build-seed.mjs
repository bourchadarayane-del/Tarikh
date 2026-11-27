// Génère supabase/seed.sql (idempotent) à partir de content/ : prophètes, guide Hajj, quiz, jours symboliques,
// et la liste des sujets de la bibliothèque d'histoires (anti-doublon).
// Usage : node scripts/build-seed.mjs   puis copier-coller supabase/seed.sql dans l'éditeur SQL de Supabase
// (ou, si le fichier est trop gros pour l'éditeur, exécuter un par un les fichiers supabase/seed/*.sql).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LANGS = ['fr', 'en', 'ar', 'es', 'id', 'ur'];
const read = (p) => JSON.parse(fs.readFileSync(path.join(root, p), 'utf8'));
// Chaîne SQL sûre : guillemets « dollar » avec une étiquette absente du texte.
const q = (value) => {
  const s = typeof value === 'string' ? value : JSON.stringify(value);
  let tag = 'tk';
  while (s.includes(`$${tag}$`)) tag += 'x';
  return `$${tag}$${s}$${tag}$`;
};
const header = (title) => `-- ${title}\n-- Fichier GÉNÉRÉ par scripts/build-seed.mjs : ne pas modifier à la main. Idempotent (peut être relancé).\n\n`;

const parts = {};
parts['00-topics'] = header("Sujets de la bibliothèque d'histoires (anti-doublon)") +
  read('content/stories/en.json').map((s) => `insert into public.story_topics (topic_key, category, title_en, origin) values (${q(s.topic_key)}, ${q(s.category)}, ${q(s.title)}, 'seed') on conflict (topic_key) do nothing;`).join('\n') + '\n';

for (const lang of LANGS) {
  let sql = header(`Contenu Premium — ${lang}`);
  for (const p of read(`content/premium/prophets/${lang}.json`)) {
    sql += `insert into public.prophets (slug, lang, ord, name, name_ar, title, story, lesson, refs) values (${q(p.slug)}, '${lang}', ${Number(p.ord)}, ${q(p.name)}, ${q(p.name_ar)}, ${q(p.title)}, ${q(p.story)}, ${q(p.lesson)}, ${q(p.refs)}::jsonb)\n  on conflict (slug, lang) do update set ord = excluded.ord, name = excluded.name, name_ar = excluded.name_ar, title = excluded.title, story = excluded.story, lesson = excluded.lesson, refs = excluded.refs;\n`;
  }
  for (const kind of ['hajj', 'quiz', 'days']) {
    sql += `insert into public.premium_content (kind, lang, payload) values ('${kind}', '${lang}', ${q(read(`content/premium/${kind}/${lang}.json`))}::jsonb)\n  on conflict (kind, lang) do update set payload = excluded.payload, updated_at = now();\n`;
  }
  parts[`10-premium-${lang}`] = sql;
}

const dir = path.join(root, 'supabase/seed');
fs.mkdirSync(dir, { recursive: true });
let all = header('Tarikh — données initiales (exécuter APRÈS schema.sql)');
for (const [name, sql] of Object.entries(parts)) {
  fs.writeFileSync(path.join(dir, `${name}.sql`), sql);
  all += `\n-- ===== ${name} =====\n${sql}`;
}
fs.writeFileSync(path.join(root, 'supabase/seed.sql'), all);
console.log(`seed.sql : ${(all.length / 1024).toFixed(0)} Ko ; ${Object.keys(parts).length} fichiers dans supabase/seed/ (${Object.entries(parts).map(([n, s]) => `${n} ${(s.length / 1024).toFixed(0)} Ko`).join(', ')})`);
