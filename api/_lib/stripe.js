import Stripe from 'stripe';

let client = null;
export function stripe() {
  if (client) return client;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw Object.assign(new Error('stripe_not_configured'), { status: 503 });
  client = new Stripe(key);
  return client;
}
