// Assemble la bibliothèque d'histoires en anglais à partir des fichiers de content/stories-new/ :
// les histoires allongées (existantes) et les nouvelles (batailles, résistance, épisodes récents),
// en les entremêlant pour alterner les thèmes (jamais deux histoires de guerre de suite).
// Usage : node scripts/merge-stories.mjs   -> écrit content/stories/en.json
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (f) => JSON.parse(fs.readFileSync(path.join(root, 'content/stories-new', f), 'utf8'));
const expanded = read('en-expanded.json');
const conflicts = [...read('en-battles-modern.json'), ...read('en-more.json')];
const CONFLICT = new Set(['battles', 'resistance', 'modern']);

const calm = expanded.filter((s) => !CONFLICT.has(s.category));
const war = [...expanded.filter((s) => CONFLICT.has(s.category)), ...conflicts.filter((s) => CONFLICT.has(s.category))];
const other = conflicts.filter((s) => !CONFLICT.has(s.category));
const peace = [...calm, ...other];

// 1 histoire de conflit pour 2 autres, en commençant par une histoire forte (pas de conflit en jour 1 sur 2).
const out = [];
let p = 0, w = 0;
while (p < peace.length || w < war.length) {
  for (let i = 0; i < 2 && p < peace.length; i++) out.push(peace[p++]);
  if (w < war.length) out.push(war[w++]);
}
const keys = out.map((s) => s.topic_key);
if (new Set(keys).size !== keys.length) { console.error('topic_key en double :', keys.filter((k, i) => keys.indexOf(k) !== i)); process.exit(1); }
fs.writeFileSync(path.join(root, 'content/stories/en.json'), JSON.stringify(out, null, 2) + '\n');
console.log(`${out.length} histoires (${war.length} de conflit, ${peace.length} autres) -> content/stories/en.json`);
console.log(out.map((s) => s.category[0]).join(''));
