// Conversion des événements Stripe et RevenueCat vers une ligne de la table `subscriptions`.
// Fonctions pures (faciles à tester).
const iso = (v, unit = 's') => (v == null || v === '' ? null : new Date(Number(v) * (unit === 's' ? 1000 : 1)).toISOString());

const STRIPE_STATUS = { trialing: 'trialing', active: 'active', past_due: 'grace', canceled: 'expired', unpaid: 'expired', incomplete_expired: 'expired', incomplete: 'incomplete', paused: 'expired' };

export function stripeSubscriptionToRow(sub, fallback = {}) {
  const item = sub.items?.data?.[0];
  const md = sub.metadata || {};
  return {
    source: 'stripe',
    external_id: sub.id,
    user_id: md.user_id || fallback.user_id || undefined,
    app_user_id: md.app_user_id || fallback.app_user_id || undefined,
    status: STRIPE_STATUS[sub.status] || 'expired',
    product_id: item?.price?.id || null,
    // Selon la version de l'API Stripe, la fin de période est sur l'abonnement ou sur sa ligne.
    current_period_end: iso(sub.current_period_end ?? item?.current_period_end),
    trial_end: iso(sub.trial_end),
    cancel_at_period_end: !!sub.cancel_at_period_end,
    stripe_customer_id: typeof sub.customer === 'string' ? sub.customer : sub.customer?.id || null,
    environment: sub.livemode ? 'production' : 'test',
  };
}

// https://www.revenuecat.com/docs/integrations/webhooks/event-types-and-fields
export function revenueCatEventToRow(ev, previous = null) {
  const type = ev.type;
  const appUserId = ev.app_user_id || ev.original_app_user_id;
  if (!appUserId || ['TEST', 'TRANSFER', 'SUBSCRIBER_ALIAS', 'NON_RENEWING_PURCHASE', 'INVOICE_ISSUANCE', 'VIRTUAL_CURRENCY_TRANSACTION', 'EXPERIMENT_ENROLLMENT'].includes(type)) return null;
  let status;
  if (type === 'EXPIRATION' || type === 'SUBSCRIPTION_PAUSED') status = 'expired';
  else if (type === 'BILLING_ISSUE') status = ev.grace_period_expiration_at_ms ? 'grace' : (previous?.status || 'active');
  else if (type === 'CANCELLATION' && ev.cancel_reason === 'CUSTOMER_SUPPORT') status = 'expired'; // remboursement
  else status = ev.period_type === 'TRIAL' ? 'trialing' : 'active';
  const end = ev.grace_period_expiration_at_ms && type === 'BILLING_ISSUE' ? ev.grace_period_expiration_at_ms : ev.expiration_at_ms;
  return {
    source: 'apple',
    external_id: String(ev.original_app_user_id || appUserId),
    app_user_id: String(appUserId),
    status,
    product_id: ev.new_product_id || ev.product_id || previous?.product_id || null,
    current_period_end: end ? iso(end, 'ms') : previous?.current_period_end ?? null,
    trial_end: ev.period_type === 'TRIAL' && ev.expiration_at_ms ? iso(ev.expiration_at_ms, 'ms') : previous?.trial_end ?? null,
    cancel_at_period_end: type === 'CANCELLATION' ? true : ['UNCANCELLATION', 'RENEWAL', 'INITIAL_PURCHASE'].includes(type) ? false : !!previous?.cancel_at_period_end,
    environment: ev.environment === 'SANDBOX' ? 'sandbox' : 'production',
  };
}

// Réponse de l'API REST RevenueCat (GET /v1/subscribers/{id}) -> ligne, pour resynchroniser à la demande.
export function revenueCatSubscriberToRow(appUserId, subscriber, entitlement = 'premium') {
  const ent = subscriber?.entitlements?.[entitlement];
  if (!ent) return null;
  const sub = subscriber.subscriptions?.[ent.product_identifier] || {};
  const expires = ent.expires_date ? new Date(ent.expires_date) : null;
  const active = !expires || expires.getTime() > Date.now();
  return {
    source: 'apple',
    external_id: String(subscriber.original_app_user_id || appUserId),
    app_user_id: String(appUserId),
    status: !active ? 'expired' : sub.period_type === 'trial' ? 'trialing' : 'active',
    product_id: ent.product_identifier || null,
    current_period_end: expires ? expires.toISOString() : null,
    trial_end: sub.period_type === 'trial' && expires ? expires.toISOString() : null,
    cancel_at_period_end: !!sub.unsubscribe_detected_at,
    environment: sub.is_sandbox ? 'sandbox' : 'production',
  };
}

export function publicStatus(row) {
  return row
    ? { premium: true, source: row.source, status: row.status, current_period_end: row.current_period_end, trial_end: row.trial_end, cancel_at_period_end: !!row.cancel_at_period_end, product_id: row.product_id }
    : { premium: false };
}
