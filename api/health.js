// Diagnostic public : dit ce qui est configuré et ce qui manque, sans jamais révéler une valeur.
// À ouvrir dans le navigateur : https://tarikh-topaz.vercel.app/api/health
import { handler, json, preflight } from './_lib/http.js';

const env = (...names) => names.find((n) => process.env[n]);
// Lit le champ « ref » (identifiant de projet) d'une clé JWT Supabase, sans vérifier la signature.
function jwtRef(token) {
  try { return JSON.parse(Buffer.from(String(token).split('.')[1], 'base64url').toString('utf8')).ref || null; } catch { return null; }
}

export async function diagnose({ fetchImpl = fetch } = {}) {
  const url = process.env.SUPABASE_URL || '';
  const projectRef = (/^https:\/\/([a-z0-9]+)\.supabase\.co/.exec(url) || [])[1] || null;
  const serviceName = env('SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_SERVICE_KEY');
  const serviceKey = serviceName ? process.env[serviceName] : '';
  const serviceRef = jwtRef(serviceKey);

  let database = 'not_checked';
  if (url && process.env.SUPABASE_ANON_KEY) {
    try {
      const res = await fetchImpl(`${url}/rest/v1/daily_stories?select=date&limit=1`, { headers: { apikey: process.env.SUPABASE_ANON_KEY, authorization: `Bearer ${process.env.SUPABASE_ANON_KEY}` }, signal: AbortSignal.timeout(6000) });
      database = res.ok ? 'ok' : res.status === 404 ? 'schema_missing' : `http_${res.status}`;
    } catch { database = 'unreachable'; }
  }

  const features = {
    site: { ok: !!process.env.PUBLIC_SITE_URL, need: ['PUBLIC_SITE_URL'].filter((n) => !process.env[n]) },
    database: {
      ok: database === 'ok' && !!serviceKey && (!serviceRef || !projectRef || serviceRef === projectRef),
      need: [
        ...['SUPABASE_URL', 'SUPABASE_ANON_KEY'].filter((n) => !process.env[n]),
        ...(serviceKey ? [] : ['SUPABASE_SERVICE_ROLE_KEY']),
      ],
      problems: [
        ...(database !== 'ok' && database !== 'not_checked' ? [`base : ${database}`] : []),
        ...(serviceKey && serviceRef && projectRef && serviceRef !== projectRef ? ['la clé service_role appartient à un AUTRE projet Supabase : remplacez-la par celle du projet tarikh'] : []),
      ],
    },
    daily_story_ai: { ok: !!process.env.ANTHROPIC_KEY && !!process.env.CRON_SECRET, need: ['ANTHROPIC_KEY', 'CRON_SECRET'].filter((n) => !process.env[n]) },
    payments_web_stripe: { ok: !!(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET && process.env.STRIPE_PRICE_ID), need: ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET', 'STRIPE_PRICE_ID'].filter((n) => !process.env[n]) },
    payments_ios_revenuecat: { ok: !!(process.env.REVENUECAT_WEBHOOK_SECRET && process.env.REVENUECAT_SECRET_API_KEY), need: ['REVENUECAT_WEBHOOK_SECRET', 'REVENUECAT_SECRET_API_KEY'].filter((n) => !process.env[n]) },
    push_onesignal: { ok: !!(env('ONESIGNAL_REST_API_KEY', 'ONESIGNAL_REST_KEY') && process.env.ONESIGNAL_APP_ID), need: [...(env('ONESIGNAL_REST_API_KEY', 'ONESIGNAL_REST_KEY') ? [] : ['ONESIGNAL_REST_API_KEY']), ...(process.env.ONESIGNAL_APP_ID ? [] : ['ONESIGNAL_APP_ID'])] },
  };
  return { ok: Object.values(features).every((f) => f.ok), database, supabase_project: projectRef, features };
}

export function createHealth(deps = {}) {
  return handler(async (request) => json(request, await diagnose(deps)));
}
export const GET = createHealth();
export const OPTIONS = preflight;
