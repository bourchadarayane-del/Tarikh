// Vérifie les traductions : mêmes clés dans les 6 langues, aucun libellé manquant ou vide,
// mêmes variables {x}, et toutes les clés utilisées dans le code existent.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LANGS = ['fr', 'en', 'ar', 'es', 'id', 'ur'];
const dict = Object.fromEntries(LANGS.map((l) => [l, JSON.parse(fs.readFileSync(path.join(root, 'web/i18n', `${l}.json`), 'utf8'))]));
const errors = [];
const ref = Object.keys(dict.fr);
const vars = (s) => (String(s).match(/\{[a-z]+\}/g) || []).sort().join(',');

for (const l of LANGS) {
  const keys = Object.keys(dict[l]);
  for (const k of ref) {
    if (!(k in dict[l])) errors.push(`${l}: clé manquante ${k}`);
    else if (!String(dict[l][k]).trim()) errors.push(`${l}: valeur vide ${k}`);
    else if (vars(dict[l][k]) !== vars(dict.fr[k])) errors.push(`${l}: variables différentes pour ${k}`);
  }
  for (const k of keys) if (!(k in dict.fr)) errors.push(`${l}: clé en trop ${k}`);
}

// Clés utilisées dans le code (littérales) et familles dynamiques (t('prefix.' + x)).
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
const files = [...walk(path.join(root, 'web/js')), path.join(root, 'web/index.html')];
const used = new Set(), prefixes = new Set();
for (const f of files) {
  const src = fs.readFileSync(f, 'utf8');
  for (const m of src.matchAll(/\bt\(\s*['"]([a-zA-Z0-9_.-]+)['"]\s*[,)]/g)) used.add(m[1]);
  for (const m of src.matchAll(/\bt\(\s*['"]([a-zA-Z0-9_.-]+\.)['"]\s*\+/g)) prefixes.add(m[1]);
  for (const m of src.matchAll(/\bt\(\s*`([a-zA-Z0-9_.-]+\.)\$\{/g)) prefixes.add(m[1]);
  for (const m of src.matchAll(/premiumCta\(\s*'([a-zA-Z0-9_.-]+)'/g)) used.add(m[1]);
  for (const m of src.matchAll(/data-i18n(?:-aria|-ph)?="([a-zA-Z0-9_.-]+)"/g)) used.add(m[1]);
  for (const m of src.matchAll(/'((?:ob|quiz|premium|streak|ramadan)\.[a-zA-Z0-9_.]*[a-zA-Z0-9])'/g)) used.add(m[1]);
}
for (const k of used) if (!(k in dict.fr)) errors.push(`code: clé utilisée mais absente ${k}`);
for (const p of prefixes) if (!ref.some((k) => k.startsWith(p))) errors.push(`code: aucune clé pour la famille ${p}*`);

if (errors.length) { console.error(errors.slice(0, 80).join('\n')); console.error(`\n${errors.length} problème(s) de traduction`); process.exit(1); }
console.log(`i18n OK : ${ref.length} clés × ${LANGS.length} langues, ${used.size} clés utilisées dans le code`);
