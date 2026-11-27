// Vérifie la syntaxe de tous les fichiers JS (node --check) et de tous les JSON du dépôt.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SKIP = new Set(['node_modules', 'www', '.git', 'ios', 'dist']);
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (SKIP.has(e.name) ? [] : e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
let bad = 0, js = 0, json = 0;
for (const f of walk(root)) {
  try {
    if (/\.(js|mjs|cjs)$/.test(f)) { execFileSync(process.execPath, ['--check', f], { stdio: 'pipe' }); js++; }
    else if (f.endsWith('.json')) { JSON.parse(fs.readFileSync(f, 'utf8')); json++; }
  } catch (err) { bad++; console.error(`ERREUR ${path.relative(root, f)}\n${String(err.stderr || err.message).split('\n').slice(0, 6).join('\n')}`); }
}
if (bad) { console.error(`${bad} fichier(s) invalide(s)`); process.exit(1); }
console.log(`Syntaxe OK : ${js} fichiers JS, ${json} fichiers JSON`);
