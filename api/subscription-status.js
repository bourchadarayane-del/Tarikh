// État de l'abonnement pour l'appelant (compte et/ou appareil). ?refresh=1 force une resynchronisation avec RevenueCat.
import { handler, json, preflight } from './_lib/http.js';
import { identify, activeSubscription } from './_lib/auth.js';
import { db as realDb } from './_lib/supabase.js';
import { publicStatus, revenueCatSubscriberToRow } from './_lib/subscriptions.js';

// Interroge RevenueCat pour cet appareil (utile juste après un achat, avant l'arrivée du webhook).
export async function syncRevenueCat(appUserId, db, fetchImpl = fetch) {
  const key = process.env.REVENUECAT_SECRET_API_KEY;
  if (!key || !appUserId) return null;
  const res = await fetchImpl(`https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(appUserId)}`, { headers: { authorization: `Bearer ${key}` } });
  if (!res.ok) return null;
  const row = revenueCatSubscriberToRow(appUserId, (await res.json()).subscriber);
  if (!row) return null;
  const userId = await db.linkedUser(appUserId);
  return db.upsertSubscription({ ...row, ...(userId ? { user_id: userId } : {}) });
}

export function createStatus({ db = realDb, fetchImpl = fetch } = {}) {
  return handler(async (request) => {
    let who;
    try { who = await identify(request, db); }
    catch (err) { if (err.status === 503) return json(request, { premium: false, configured: false }); throw err; }
    if (!who.userId && !who.appUserId) return json(request, { premium: false });
    let row;
    try { row = await activeSubscription(who, db); }
    catch (err) { if (err.status === 503) return json(request, { premium: false, configured: false }); throw err; }
    const refresh = new URL(request.url).searchParams.get('refresh') === '1';
    if (!row && refresh && who.appUserId) {
      try { await syncRevenueCat(who.appUserId, db, fetchImpl); row = await activeSubscription(who, db); } catch (err) { console.error('[revenuecat sync]', err.message); }
    }
    return json(request, publicStatus(row));
  });
}
export const GET = createStatus();
export const OPTIONS = preflight;
