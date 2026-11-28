// Webhook Stripe (web) : signature vérifiée sur le corps BRUT, traitement idempotent, écriture dans `subscriptions`.
// Test local : stripe listen --forward-to localhost:3000/api/stripe-webhook
import Stripe from 'stripe';
import { handler, json, fail } from './_lib/http.js';
import { db as realDb } from './_lib/supabase.js';
import { stripe as realStripe } from './_lib/stripe.js';
import { stripeSubscriptionToRow } from './_lib/subscriptions.js';

// Objet utilisé uniquement pour vérifier les signatures (aucune requête réseau, aucune vraie clé).
const verifier = new Stripe('signature-check-only');

export function createStripeWebhook({ db = realDb, stripe = realStripe } = {}) {
  return handler(async (request) => {
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!secret) return fail(null, 503, 'webhook_not_configured');
    const raw = await request.text();
    let event;
    try { event = await verifier.webhooks.constructEventAsync(raw, request.headers.get('stripe-signature') || '', secret); }
    catch { return fail(null, 400, 'invalid_signature'); }

    if (!(await db.recordEvent('stripe', event.id))) return json(null, { received: true, duplicate: true });
    try {
      const obj = event.data.object;
      if (event.type === 'checkout.session.completed' && obj.mode === 'subscription' && obj.subscription) {
        const sub = await stripe().subscriptions.retrieve(typeof obj.subscription === 'string' ? obj.subscription : obj.subscription.id);
        await db.upsertSubscription(stripeSubscriptionToRow(sub, { user_id: obj.client_reference_id || obj.metadata?.user_id, app_user_id: obj.metadata?.app_user_id }));
      } else if (['customer.subscription.created', 'customer.subscription.updated', 'customer.subscription.deleted'].includes(event.type)) {
        // Les événements peuvent arriver dans le désordre : on relit l'état actuel chez Stripe (source fiable).
        let fresh = obj;
        try { fresh = await stripe().subscriptions.retrieve(obj.id); } catch { /* abonnement supprimé : on garde l'objet reçu */ }
        const row = stripeSubscriptionToRow(fresh);
        await db.upsertSubscription(event.type.endsWith('deleted') ? { ...row, status: 'expired' } : row);
      }
    } catch (err) {
      await db.forgetEvent('stripe', event.id); // Stripe réessaiera
      throw err;
    }
    return json(null, { received: true });
  });
}
export const POST = createStripeWebhook();
