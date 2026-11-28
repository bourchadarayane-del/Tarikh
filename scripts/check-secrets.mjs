// Vérifie qu'aucun secret n'est suivi par git (à lancer avant chaque commit : npm run check:secrets).
// Cherche de VRAIES valeurs (préfixe + longue suite de caractères), pas les simples noms de variables.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';

const PATTERNS = [
  ['clé secrète Stripe', /\b[sr]k_(live|test)_[A-Za-z0-9]{16,}/],
  ['secret de webhook Stripe', /\bwhsec_[A-Za-z0-9]{16,}/],
  ['clé Anthropic', /\bsk-ant-[A-Za-z0-9_-]{16,}/],
  ['clé RevenueCat', /\b(appl|goog|rcb|sk)_[A-Za-z0-9]{20,}/],
  ['jeton JWT (ex. clé Supabase)', /\beyJ[A-Za-z0-9_-]{15,}\.eyJ[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{10,}/],
  ['clé Supabase', /\bsb_(secret|publishable)_[A-Za-z0-9_-]{16,}/],
  ['clé privée', /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
  ['clé OneSignal', /\bos_v2_(app|org)_[A-Za-z0-9]{20,}/],
];
const files = execFileSync('git', ['ls-files', '-co', '--exclude-standard'], { encoding: 'utf8' }).split('\n').filter(Boolean);
const hits = [];
for (const f of files) {
  if (/\.(png|jpg|jpeg|woff2?|ico|pdf)$/i.test(f) || f === 'package-lock.json' || !fs.existsSync(f) || fs.statSync(f).size > 3_000_000) continue;
  if (/^\.env(\.|$)/.test(f) && f !== '.env.example') { hits.push(`${f} : fichier d'environnement suivi par git`); continue; }
  const text = fs.readFileSync(f, 'utf8');
  for (const [name, re] of PATTERNS) { const m = re.exec(text); if (m) hits.push(`${f} : ${name} (${m[0].slice(0, 10)}…)`); }
}
if (hits.length) { console.error('SECRETS DÉTECTÉS — ne pas committer :\n' + hits.join('\n')); process.exit(1); }
console.log(`Aucun secret détecté dans ${files.length} fichiers.`);
