// Cron Vercel quotidien (voir vercel.json). Vercel envoie « Authorization: Bearer <CRON_SECRET> ».
// Génère l'histoire et le rappel d'aujourd'hui et de demain (UTC) dans les 6 langues, puis envoie la notification.
// Idempotent : un second passage (cron de secours) ne recrée que ce qui manque.
import { handler, json } from './_lib/http.js';
import { requireCron } from './_lib/auth.js';
import { db as realDb } from './_lib/supabase.js';
import { runDaily } from './_lib/daily.js';
import { sendDailyPush } from './_lib/onesignal.js';

export const config = { maxDuration: 300 };

export function createCron({ db = realDb, call, notify = sendDailyPush } = {}) {
  return handler(async (request) => {
    requireCron(request);
    const url = new URL(request.url);
    const result = await runDaily({ db, call, notify: url.searchParams.get('notify') === '0' ? null : notify });
    return json(null, result, result.ok ? 200 : 500);
  });
}
export const GET = createCron();
