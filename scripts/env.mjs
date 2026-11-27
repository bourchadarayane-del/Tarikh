// Charge .env.local puis .env (sans dépendance). Ne remplace jamais une variable déjà définie.
import fs from 'node:fs';
import path from 'node:path';

export function loadEnv(root = process.cwd()) {
  for (const name of ['.env.local', '.env']) {
    const file = path.join(root, name);
    if (!fs.existsSync(file)) continue;
    for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
      if (!m || line.trim().startsWith('#')) continue;
      let value = m[2];
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
      if (process.env[m[1]] === undefined) process.env[m[1]] = value;
    }
  }
}
