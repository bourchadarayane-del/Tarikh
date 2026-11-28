// WEB : portail client Stripe (changer de carte, annuler, factures).
import { handler, json, fail, preflight, siteUrl } from './_lib/http.js';
import { requireUser } from './_lib/auth.js';
import { db as realDb } from './_lib/supabase.js';
import { stripe as realStripe } from './_lib/stripe.js';

export function createPortal({ db = realDb, stripe = realStripe } = {}) {
  return handler(async (request) => {
    const who = await requireUser(request, db);
    const customer = (await db.subscriptionsFor(who)).find((r) => r.source === 'stripe' && r.stripe_customer_id)?.stripe_customer_id;
    if (!customer) return fail(request, 404, 'no_stripe_customer');
    const session = await stripe().billingPortal.sessions.create({ customer, return_url: `${siteUrl()}/#/premium` });
    return json(request, { url: session.url });
  });
}
export const POST = createPortal();
export const OPTIONS = preflight;
