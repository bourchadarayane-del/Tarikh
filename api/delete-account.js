// Suppression du compte DANS l'application (exigence Apple 5.1.1(v)).
// Supprime le profil, les favoris, les liens d'appareils et le compte ; annule l'abonnement Stripe.
// Un abonnement Apple ne peut être annulé que par l'utilisateur dans les réglages de son compte Apple.
import { handler, json, fail, preflight, readJson } from './_lib/http.js';
import { requireUser } from './_lib/auth.js';
import { db as realDb } from './_lib/supabase.js';
import { stripe as realStripe } from './_lib/stripe.js';

export function createDeleteAccount({ db = realDb, stripe = realStripe } = {}) {
  return handler(async (request) => {
    const who = await requireUser(request, db);
    const body = await readJson(request);
    if (body.confirm !== true) return fail(request, 400, 'confirmation_required');
    const subs = await db.subscriptionsFor({ userId: who.userId, appUserId: null });
    const cancelled = [];
    for (const s of subs.filter((r) => r.source === 'stripe' && ['active', 'trialing', 'grace', 'incomplete'].includes(r.status))) {
      try { await stripe().subscriptions.cancel(s.external_id); cancelled.push(s.external_id); await db.upsertSubscription({ source: 'stripe', external_id: s.external_id, status: 'expired' }); }
      catch (err) { console.error('[delete-account] stripe', err.message); }
    }
    await db.deleteUserData(who.userId);
    await db.deleteUser(who.userId);
    return json(request, { deleted: true, stripe_cancelled: cancelled.length, apple_subscription: subs.some((r) => r.source === 'apple' && ['active', 'trialing', 'grace'].includes(r.status)) });
  });
}
export const POST = createDeleteAccount();
export const OPTIONS = preflight;
