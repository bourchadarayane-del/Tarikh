// Webhook RevenueCat (abonnements Apple) : authentifié par un secret partagé dans l'en-tête Authorization,
// idempotent, écrit dans la même table `subscriptions` que Stripe.
import { handler, json, fail, readJson } from './_lib/http.js';
import { bearer, safeEqual } from './_lib/auth.js';
import { db as realDb } from './_lib/supabase.js';
import { revenueCatEventToRow } from './_lib/subscriptions.js';

export function createRevenueCatWebhook({ db = realDb } = {}) {
  return handler(async (request) => {
    const secret = process.env.REVENUECAT_WEBHOOK_SECRET;
    if (!secret) return fail(null, 503, 'webhook_not_configured');
    // RevenueCat envoie exactement la valeur saisie dans son tableau de bord (avec ou sans « Bearer »).
    const header = request.headers.get('authorization') || '';
    if (!safeEqual(bearer(request) || header, secret) && !safeEqual(header, secret)) return fail(null, 401, 'unauthorized');
    const ev = (await readJson(request, 256 * 1024)).event;
    if (!ev || !ev.id || !ev.type) return fail(null, 400, 'invalid_event');

    if (!(await db.recordEvent('revenuecat', String(ev.id)))) return json(null, { received: true, duplicate: true });
    try {
      if (ev.type === 'TRANSFER') {
        await db.moveAppUser(ev.transferred_from || [], (ev.transferred_to || [])[0]);
      } else {
        const externalId = String(ev.original_app_user_id || ev.app_user_id || '');
        const previous = externalId ? await db.getSubscription('apple', externalId) : null;
        const row = revenueCatEventToRow(ev, previous);
        if (row) {
          const userId = previous?.user_id || (await db.linkedUser(row.app_user_id));
          await db.upsertSubscription({ ...row, ...(userId ? { user_id: userId } : {}) });
        }
      }
    } catch (err) {
      await db.forgetEvent('revenuecat', String(ev.id)); // RevenueCat réessaiera
      throw err;
    }
    return json(null, { received: true });
  });
}
export const POST = createRevenueCatWebhook();
