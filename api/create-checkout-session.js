// WEB UNIQUEMENT : crée une session Stripe Checkout (abonnement mensuel, essai gratuit de 7 jours).
// L'application iOS n'appelle jamais cet endpoint (achat intégré Apple obligatoire).
import { handler, json, fail, preflight, readJson, siteUrl } from './_lib/http.js';
import { requireUser, activeSubscription } from './_lib/auth.js';
import { db as realDb } from './_lib/supabase.js';
import { stripe as realStripe } from './_lib/stripe.js';

const LOCALES = { fr: 'fr', en: 'en', es: 'es', id: 'id', ar: 'auto', ur: 'auto' };

export function createCheckout({ db = realDb, stripe = realStripe } = {}) {
  return handler(async (request) => {
    const who = await requireUser(request, db);
    const price = process.env.STRIPE_PRICE_ID;
    if (!price) return fail(request, 503, 'stripe_not_configured');
    if (await activeSubscription(who, db)) return fail(request, 409, 'already_subscribed');
    const body = await readJson(request);
    const previous = (await db.subscriptionsFor(who)).filter((r) => r.source === 'stripe');
    const customer = previous.find((r) => r.stripe_customer_id)?.stripe_customer_id;
    const metadata = { user_id: who.userId, ...(who.appUserId ? { app_user_id: who.appUserId } : {}) };
    const session = await stripe().checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price, quantity: 1 }],
      client_reference_id: who.userId,
      ...(customer ? { customer } : { customer_email: who.email || undefined }),
      // Essai de 7 jours, une seule fois par compte.
      subscription_data: { metadata, ...(previous.length ? {} : { trial_period_days: 7 }) },
      metadata,
      locale: LOCALES[body.lang] || 'auto',
      allow_promotion_codes: true,
      success_url: `${siteUrl()}/?checkout=success#/premium`,
      cancel_url: `${siteUrl()}/?checkout=cancel#/premium`,
    });
    return json(request, { url: session.url });
  });
}
export const POST = createCheckout();
export const OPTIONS = preflight;
