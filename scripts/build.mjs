// Build de l'appli web : web/ + content/ -> www/ (servi par Vercel et embarqué par Capacitor).
// Usage : node scripts/build.mjs
import { build } from 'esbuild';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadEnv } from './env.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = path.join(root, 'web');
const out = path.join(root, 'www');
const require = createRequire(import.meta.url);
loadEnv(root);

const rel = (p) => path.relative(out, p).split(path.sep).join('/');
function copyDir(from, to, filter = () => true) {
  if (!fs.existsSync(from)) return;
  fs.mkdirSync(to, { recursive: true });
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    const a = path.join(from, entry.name);
    const b = path.join(to, entry.name);
    if (entry.isDirectory()) copyDir(a, b, filter);
    else if (filter(a)) fs.copyFileSync(a, b);
  }
}
function walk(dir, acc = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(p, acc);
    else acc.push(p);
  }
  return acc;
}
const minifyJson = (file) => fs.writeFileSync(file, JSON.stringify(JSON.parse(fs.readFileSync(file, 'utf8'))));

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });

// 1. Fichiers statiques (tout sauf les sources JS, les traductions déjà incluses dans le bundle et le gabarit du SW).
copyDir(src, out, (f) => {
  const r = path.relative(src, f).split(path.sep).join('/');
  return !r.startsWith('js/') && !r.startsWith('i18n/') && r !== 'sw.template.js';
});

// 2. Histoires de secours (gratuites, utilisables hors-ligne).
copyDir(path.join(root, 'content', 'stories'), path.join(out, 'data', 'stories'));
for (const f of walk(path.join(out, 'data')).filter((f) => f.endsWith('.json'))) minifyJson(f);

// 2b. Index PUBLIC du contenu Premium (titres + aperçu gratuit : 1er prophète, 5 questions de quiz).
// Le contenu complet n'est jamais dans le bundle : il est servi par /api/premium-content après vérification.
const LANGS = ['fr', 'en', 'ar', 'es', 'id', 'ur'];
const readJson = (p) => (fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : null);
fs.mkdirSync(path.join(out, 'data', 'premium-index'), { recursive: true });
for (const l of LANGS) {
  const dir = path.join(root, 'content', 'premium');
  const prophets = readJson(path.join(dir, 'prophets', `${l}.json`)) || readJson(path.join(dir, 'prophets', 'en.json'));
  const hajj = readJson(path.join(dir, 'hajj', `${l}.json`)) || readJson(path.join(dir, 'hajj', 'en.json'));
  const quiz = readJson(path.join(dir, 'quiz', `${l}.json`)) || readJson(path.join(dir, 'quiz', 'en.json'));
  if (!prophets || !hajj || !quiz) continue;
  const part = (x) => ({ title: x.title, chapters: x.chapters.map((c) => c.title) });
  fs.writeFileSync(path.join(out, 'data', 'premium-index', `${l}.json`), JSON.stringify({
    prophets: prophets.map((p) => ({ slug: p.slug, name: p.name, name_ar: p.name_ar, title: p.title })),
    sample: prophets[0],
    hajj: { umrah: part(hajj.umrah), hajj: part(hajj.hajj) },
    quizSample: ['q001', 'q016', 'q031', 'q061', 'q076'].map((id) => quiz.find((q) => q.id === id)).filter(Boolean),
    quizTotal: quiz.length,
  }));
}

// 3. Villes pour la recherche hors-ligne (>= 100 000 habitants) : [nom, pays, lat, lon].
const cities = require('all-the-cities')
  .filter((c) => c.population >= 100000)
  .sort((a, b) => b.population - a.population)
  .map((c) => [c.name, c.country, +c.loc.coordinates[1].toFixed(3), +c.loc.coordinates[0].toFixed(3)]);
fs.writeFileSync(path.join(out, 'data', 'cities.json'), JSON.stringify(cities));

// 4. Polices auto-hébergées (aucun appel à Google Fonts : plus rapide, hors-ligne, meilleur pour la vie privée).
const fonts = [
  ['@fontsource-variable/inter/files/inter-latin-wght-normal.woff2', 'inter-latin.woff2'],
  ['@fontsource-variable/inter/files/inter-latin-ext-wght-normal.woff2', 'inter-latin-ext.woff2'],
  ['@fontsource/playfair-display/files/playfair-display-latin-400-normal.woff2', 'playfair-400.woff2'],
  ['@fontsource/playfair-display/files/playfair-display-latin-700-normal.woff2', 'playfair-700.woff2'],
  ['@fontsource/playfair-display/files/playfair-display-latin-400-italic.woff2', 'playfair-400-italic.woff2'],
  ['@fontsource/playfair-display/files/playfair-display-latin-ext-400-normal.woff2', 'playfair-ext-400.woff2'],
  ['@fontsource/playfair-display/files/playfair-display-latin-ext-700-normal.woff2', 'playfair-ext-700.woff2'],
  ['@fontsource/playfair-display/files/playfair-display-latin-ext-400-italic.woff2', 'playfair-ext-400-italic.woff2'],
  ['@fontsource/amiri/files/amiri-arabic-400-normal.woff2', 'amiri-arabic-400.woff2'],
  ['@fontsource/amiri/files/amiri-arabic-700-normal.woff2', 'amiri-arabic-700.woff2'],
  ['@fontsource/noto-nastaliq-urdu/files/noto-nastaliq-urdu-arabic-400-normal.woff2', 'nastaliq-400.woff2'],
  ['@fontsource/noto-nastaliq-urdu/files/noto-nastaliq-urdu-arabic-700-normal.woff2', 'nastaliq-700.woff2'],
];
fs.mkdirSync(path.join(out, 'fonts'), { recursive: true });
for (const [from, to] of fonts) fs.copyFileSync(path.join(root, 'node_modules', from), path.join(out, 'fonts', to));

// 5. JavaScript : un bundle ES module, découpé pour charger les outils à la demande.
await build({
  entryPoints: [path.join(src, 'js', 'main.js')],
  outdir: path.join(out, 'assets'),
  bundle: true,
  format: 'esm',
  splitting: true,
  minify: true,
  sourcemap: false,
  target: ['safari15', 'chrome100'],
  entryNames: 'app',
  chunkNames: 'chunk-[hash]',
  loader: { '.json': 'json' },
  logLevel: 'warning',
});

// 6. Configuration PUBLIQUE injectée depuis l'environnement (jamais de clé secrète ici).
const env = process.env;
const config = {
  supabaseUrl: env.SUPABASE_URL || '',
  supabaseAnonKey: env.SUPABASE_ANON_KEY || '',
  oneSignalAppId: env.ONESIGNAL_APP_ID || '',
  revenueCatIosKey: env.REVENUECAT_IOS_PUBLIC_KEY || '',
  siteUrl: (env.PUBLIC_SITE_URL || 'https://tarikh-topaz.vercel.app').replace(/\/$/, ''),
  version: JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).version,
};
for (const [k, v] of Object.entries(config)) {
  if (/service_role|^sk_|^whsec_|^sk-ant/.test(String(v))) throw new Error(`Valeur secrète refusée dans la config publique : ${k}`);
}
fs.writeFileSync(path.join(out, 'config.js'), `window.TARIKH_CONFIG=${JSON.stringify(config)};\n`);

// 7. Service worker : liste de précache + version dérivée du contenu.
const files = walk(out).map(rel).filter((f) => !['sw.js'].includes(f)).sort();
const lazy = (f) => f.startsWith('fonts/nastaliq') || f.startsWith('screenshots/');
const precache = files.filter((f) => !lazy(f));
const hash = createHash('sha256');
for (const f of files) hash.update(f).update(fs.readFileSync(path.join(out, f)));
const version = hash.digest('hex').slice(0, 12);
const sw = fs.readFileSync(path.join(src, 'sw.template.js'), 'utf8')
  .replace('__VERSION__', version)
  .replace('"__PRECACHE__"', JSON.stringify(precache.map((f) => '/' + f)));
fs.writeFileSync(path.join(out, 'sw.js'), sw);

const size = walk(out).reduce((n, f) => n + fs.statSync(f).size, 0);
console.log(`Build OK -> www/ (${files.length} fichiers, ${(size / 1024 / 1024).toFixed(2)} Mo, version ${version})`);
if (!config.supabaseUrl || !config.supabaseAnonKey) {
  console.log('Note : SUPABASE_URL / SUPABASE_ANON_KEY absents -> l\'appli utilisera uniquement les contenus embarqués.');
}
