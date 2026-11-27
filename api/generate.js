// Génération manuelle (administration) : POST protégé par CRON_SECRET. Ce n'est PAS un endpoint public :
// l'ancien proxy ouvert vers l'API Anthropic a été supprimé (n'importe qui pouvait consommer la clé).
// Exemple : curl -X POST https://…/api/generate -H "Authorization: Bearer $CRON_SECRET" -d '{"date":"2026-12-01"}'
import { handler, json, readJson } from './_lib/http.js';
import { requireCron } from './_lib/auth.js';
import { db as realDb } from './_lib/supabase.js';
import { runDaily } from './_lib/daily.js';

export const config = { maxDuration: 300 };

export function createGenerate({ db = realDb, call } = {}) {
  return handler(async (request) => {
    requireCron(request);
    const body = await readJson(request);
    const dates = body.date ? [String(body.date)] : undefined;
    if (dates && !/^\d{4}-\d{2}-\d{2}$/.test(dates[0])) return json(null, { error: 'invalid_date' }, 400);
    const result = await runDaily({ db, call, notify: null, dates });
    return json(null, result, result.ok ? 200 : 500);
  });
}
export const POST = createGenerate();
