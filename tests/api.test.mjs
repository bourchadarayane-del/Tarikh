// Serveur : webhooks (signatures, idempotence), statut d'abonnement, contenu Premium, paiement, suppression de compte, cron.
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import Stripe from 'stripe';
import { fakeDb, req } from './helpers/fakedb.mjs';

const secret = (n = 24) => randomBytes(n).toString('hex');
process.env.STRIPE_WEBHOOK_SECRET = secret();
process.env.REVENUECAT_WEBHOOK_SECRET = secret();
process.env.CRON_SECRET = secret();
process.env.STRIPE_PRICE_ID = 'price_test_monthly';
delete process.env.ANTHROPIC_KEY;
delete process.env.REVENUECAT_SECRET_API_KEY;

const { createStripeWebhook } = await import('../api/stripe-webhook.js');
const { createRevenueCatWebhook } = await import('../api/revenuecat-webhook.js');
const { createStatus } = await import('../api/subscription-status.js');
const { createPremiumContent } = await import('../api/premium-content.js');
const { createCheckout } = await import('../api/create-checkout-session.js');
const { createPortal } = await import('../api/create-portal-session.js');
const { createDeleteAccount } = await import('../api/delete-account.js');
const { createLinkDevice } = await import('../api/link-device.js');
const { createCron } = await import('../api/cron-daily.js');
const { createGenerate } = await import('../api/generate.js');
const { stripeSubscriptionToRow, revenueCatEventToRow, revenueCatSubscriberToRow } = await import('../api/_lib/subscriptions.js');

const signer = new Stripe('signature-check-only');
const future = Math.floor(Date.now() / 1000) + 7 * 86400;
const stripeSub = (over = {}) => ({ id: 'sub_1', object: 'subscription', status: 'trialing', customer: 'cus_1', cancel_at_period_end: false, trial_end: future, livemode: false,
  metadata: { user_id: 'user-1', app_user_id: 'device-aaaaaaaa' }, items: { data: [{ current_period_end: future, price: { id: 'price_test_monthly' } }] }, ...over });
async function stripeReq(event, { sign = true, key = process.env.STRIPE_WEBHOOK_SECRET } = {}) {
  const payload = JSON.stringify(event);
  const header = sign ? await signer.webhooks.generateTestHeaderStringAsync({ payload, secret: key }) : 't=1,v1=bad';
  return req('/api/stripe-webhook', { method: 'POST', headers: { 'stripe-signature': header, 'content-type': 'application/json' }, body: payload });
}
const fakeStripe = (subs = {}, log = []) => () => ({
  subscriptions: { retrieve: async (id) => { if (!subs[id]) throw new Error('missing'); return subs[id]; }, cancel: async (id) => { log.push(['cancel', id]); return { id, status: 'canceled' }; } },
  checkout: { sessions: { create: async (args) => { log.push(['checkout', args]); return { url: 'https://checkout.stripe.com/c/pay/test' }; } } },
  billingPortal: { sessions: { create: async (args) => { log.push(['portal', args]); return { url: 'https://billing.stripe.com/p/session/test' }; } } },
});

test('Stripe : signature invalide rejetée (400), rien écrit', async () => {
  const db = fakeDb();
  const handler = createStripeWebhook({ db, stripe: fakeStripe() });
  const ev = { id: 'evt_bad', type: 'customer.subscription.updated', data: { object: stripeSub() } };
  assert.equal((await handler(await stripeReq(ev, { sign: false }))).status, 400);
  assert.equal((await handler(await stripeReq(ev, { key: secret() }))).status, 400);
  assert.equal(db.state.subs.length, 0);
});

test('Stripe : checkout terminé -> essai enregistré ; événement rejoué = aucun doublon', async () => {
  const db = fakeDb();
  const handler = createStripeWebhook({ db, stripe: fakeStripe({ sub_1: stripeSub() }) });
  const ev = { id: 'evt_1', type: 'checkout.session.completed', data: { object: { mode: 'subscription', subscription: 'sub_1', client_reference_id: 'user-1', metadata: { app_user_id: 'device-aaaaaaaa' } } } };
  assert.equal((await handler(await stripeReq(ev))).status, 200);
  const again = await handler(await stripeReq(ev));
  assert.equal((await again.json()).duplicate, true);
  assert.equal(db.state.subs.length, 1);
  assert.deepEqual({ status: db.state.subs[0].status, user: db.state.subs[0].user_id, source: db.state.subs[0].source, customer: db.state.subs[0].stripe_customer_id }, { status: 'trialing', user: 'user-1', source: 'stripe', customer: 'cus_1' });
});

test('Stripe : mise à jour, annulation programmée puis expiration (upsert idempotent)', async () => {
  const db = fakeDb();
  const subs = { sub_1: stripeSub({ status: 'active', trial_end: null }) };
  const handler = createStripeWebhook({ db, stripe: fakeStripe(subs) });
  await handler(await stripeReq({ id: 'evt_a', type: 'customer.subscription.updated', data: { object: subs.sub_1 } }));
  assert.equal(db.state.subs[0].status, 'active');
  subs.sub_1 = stripeSub({ status: 'active', cancel_at_period_end: true });
  await handler(await stripeReq({ id: 'evt_b', type: 'customer.subscription.updated', data: { object: subs.sub_1 } }));
  assert.equal(db.state.subs[0].cancel_at_period_end, true);
  subs.sub_1 = stripeSub({ status: 'canceled' });
  await handler(await stripeReq({ id: 'evt_c', type: 'customer.subscription.deleted', data: { object: subs.sub_1 } }));
  assert.equal(db.state.subs.length, 1); assert.equal(db.state.subs[0].status, 'expired');
});

test('Stripe : en cas d\'erreur de traitement, l\'événement pourra être rejoué', async () => {
  const db = fakeDb();
  db.upsertSubscription = async () => { throw new Error('db down'); };
  const handler = createStripeWebhook({ db, stripe: fakeStripe({ sub_1: stripeSub() }) });
  const ev = { id: 'evt_retry', type: 'customer.subscription.created', data: { object: stripeSub() } };
  assert.equal((await handler(await stripeReq(ev))).status, 500);
  assert.equal(db.state.events.has('stripe:evt_retry'), false);
});

const rcEvent = (over = {}) => ({ id: 'rc-1', type: 'INITIAL_PURCHASE', app_user_id: 'device-bbbbbbbb', original_app_user_id: 'device-bbbbbbbb', product_id: 'tarikh_premium_monthly', period_type: 'TRIAL', expiration_at_ms: Date.now() + 7 * 86400000, environment: 'SANDBOX', ...over });
const rcReq = (event, auth = `Bearer ${process.env.REVENUECAT_WEBHOOK_SECRET}`) => req('/api/revenuecat-webhook', { method: 'POST', headers: { authorization: auth, 'content-type': 'application/json' }, body: { api_version: '1.0', event } });

test('RevenueCat : secret manquant ou faux rejeté (401)', async () => {
  const db = fakeDb(); const handler = createRevenueCatWebhook({ db });
  assert.equal((await handler(rcReq(rcEvent(), 'Bearer wrong'))).status, 401);
  assert.equal((await handler(rcReq(rcEvent(), ''))).status, 401);
  assert.equal(db.state.subs.length, 0);
});

test('RevenueCat : achat (essai) -> renouvellement -> annulation -> expiration, sans doublon', async () => {
  const db = fakeDb(); const handler = createRevenueCatWebhook({ db });
  assert.equal((await handler(rcReq(rcEvent()))).status, 200);
  assert.equal((await (await handler(rcReq(rcEvent()))).json()).duplicate, true);
  assert.equal(db.state.subs.length, 1);
  assert.deepEqual({ s: db.state.subs[0].status, src: db.state.subs[0].source, env: db.state.subs[0].environment }, { s: 'trialing', src: 'apple', env: 'sandbox' });
  await handler(rcReq(rcEvent({ id: 'rc-2', type: 'RENEWAL', period_type: 'NORMAL', expiration_at_ms: Date.now() + 30 * 86400000 })));
  assert.equal(db.state.subs[0].status, 'active');
  await handler(rcReq(rcEvent({ id: 'rc-3', type: 'CANCELLATION', period_type: 'NORMAL', cancel_reason: 'UNSUBSCRIBE', expiration_at_ms: Date.now() + 30 * 86400000 })));
  assert.equal(db.state.subs[0].status, 'active'); assert.equal(db.state.subs[0].cancel_at_period_end, true);
  await handler(rcReq(rcEvent({ id: 'rc-4', type: 'EXPIRATION', period_type: 'NORMAL', expiration_at_ms: Date.now() - 1000 })));
  assert.equal(db.state.subs[0].status, 'expired'); assert.equal(db.state.subs.length, 1);
  // Authorization sans « Bearer » (valeur brute saisie dans RevenueCat) acceptée aussi.
  assert.equal((await handler(rcReq(rcEvent({ id: 'rc-5', type: 'TEST' }), process.env.REVENUECAT_WEBHOOK_SECRET))).status, 200);
});

test('Statut et contenu Premium : vérification serveur, jamais sans abonnement actif', async () => {
  const db = fakeDb({ prophets: { fr: [{ slug: 'adam', ord: 1, name: 'Adam', story: '…' }] }, premium: { 'quiz:fr': [{ id: 'q001' }] } });
  const status = createStatus({ db }), content = createPremiumContent({ db });
  const h = { 'x-app-user-id': 'device-bbbbbbbb' };
  assert.deepEqual(await (await status(req('/api/subscription-status', { headers: h }))).json(), { premium: false });
  assert.equal((await content(req('/api/premium-content?kind=prophets&lang=fr', { headers: h }))).status, 402);
  assert.equal((await content(req('/api/premium-content?kind=prophets&lang=fr'))).status, 401);
  assert.equal((await content(req('/api/premium-content?kind=secrets&lang=fr', { headers: h }))).status, 400);
  await createRevenueCatWebhook({ db })(rcReq(rcEvent({ id: 'rc-10' })));
  const st = await (await status(req('/api/subscription-status', { headers: h }))).json();
  assert.equal(st.premium, true); assert.equal(st.source, 'apple'); assert.equal(st.status, 'trialing');
  const ok = await content(req('/api/premium-content?kind=prophets&lang=fr', { headers: h }));
  assert.equal(ok.status, 200); assert.equal((await ok.json()).data[0].slug, 'adam');
  // Base vide pour une langue : repli sur les fichiers embarqués (25 prophètes, quiz, guide, jours).
  for (const [kind, n] of [['prophets', 25], ['quiz', 120]]) { const r = await content(req(`/api/premium-content?kind=${kind}&lang=ur`, { headers: h })); assert.equal(r.status, 200); assert.equal((await r.json()).data.length, n, kind); }
  for (const kind of ['hajj', 'days']) assert.equal((await content(req(`/api/premium-content?kind=${kind}&lang=ar`, { headers: h }))).status, 200, kind);
  assert.equal((await content(req('/api/premium-content?kind=quiz&lang=fr', { headers: { 'x-app-user-id': 'device-cccccccc' } }))).status, 402);
  // Abonnement expiré -> plus d'accès.
  db.state.subs[0].status = 'expired';
  assert.equal((await content(req('/api/premium-content?kind=prophets&lang=fr', { headers: h }))).status, 402);
  // Période dépassée même si le statut dit « active ».
  db.state.subs[0].status = 'active'; db.state.subs[0].current_period_end = new Date(Date.now() - 3 * 86400000).toISOString();
  assert.equal((await (await status(req('/api/subscription-status', { headers: h }))).json()).premium, false);
});

test('Synchronisation web <-> iOS : un appareil relié au compte partage l\'abonnement', async () => {
  const db = fakeDb({ users: { 'token-1': { id: 'user-1', email: 'a@example.com' } } });
  await createStripeWebhook({ db, stripe: fakeStripe({ sub_1: stripeSub({ metadata: { user_id: 'user-1' } }) }) })(await stripeReq({ id: 'evt_s', type: 'customer.subscription.created', data: { object: stripeSub({ metadata: { user_id: 'user-1' } }) } }));
  const status = createStatus({ db });
  assert.equal((await (await status(req('/s', { headers: { 'x-app-user-id': 'iphone-dddddddd' } }))).json()).premium, false);
  assert.equal((await createLinkDevice({ db })(req('/api/link-device', { method: 'POST', headers: { 'x-app-user-id': 'iphone-dddddddd' }, body: {} }))).status, 401);
  assert.equal((await createLinkDevice({ db })(req('/api/link-device', { method: 'POST', headers: { authorization: 'Bearer token-1', 'x-app-user-id': 'iphone-dddddddd' }, body: {} }))).status, 200);
  assert.equal((await (await status(req('/s', { headers: { 'x-app-user-id': 'iphone-dddddddd' } }))).json()).premium, true);
});

test('Paiement web : connexion obligatoire, essai 7 jours, référence utilisateur, portail', async () => {
  const log = []; const db = fakeDb({ users: { 'token-1': { id: 'user-1', email: 'a@example.com' } } });
  const checkout = createCheckout({ db, stripe: fakeStripe({}, log) });
  assert.equal((await checkout(req('/api/create-checkout-session', { method: 'POST', body: {} }))).status, 401);
  const res = await checkout(req('/api/create-checkout-session', { method: 'POST', headers: { authorization: 'Bearer token-1', 'x-app-user-id': 'device-aaaaaaaa' }, body: { lang: 'fr' } }));
  assert.equal(res.status, 200); assert.match((await res.json()).url, /^https:\/\/checkout\.stripe\.com\//);
  const args = log[0][1];
  assert.equal(args.mode, 'subscription'); assert.equal(args.client_reference_id, 'user-1'); assert.equal(args.subscription_data.trial_period_days, 7);
  assert.equal(args.line_items[0].price, 'price_test_monthly'); assert.equal(args.subscription_data.metadata.app_user_id, 'device-aaaaaaaa');
  assert.equal((await createPortal({ db, stripe: fakeStripe({}, log) })(req('/p', { method: 'POST', headers: { authorization: 'Bearer token-1' }, body: {} }))).status, 404);
  await db.upsertSubscription(stripeSubscriptionToRow(stripeSub()));
  assert.equal((await checkout(req('/c', { method: 'POST', headers: { authorization: 'Bearer token-1' }, body: {} }))).status, 409);
  assert.equal((await createPortal({ db, stripe: fakeStripe({}, log) })(req('/p', { method: 'POST', headers: { authorization: 'Bearer token-1' }, body: {} }))).status, 200);
});

test('Suppression de compte : confirmation exigée, Stripe annulé, données supprimées', async () => {
  const log = []; const db = fakeDb({ users: { 'token-1': { id: 'user-1', email: 'a@example.com' } }, links: { 'device-aaaaaaaa': 'user-1' } });
  await db.upsertSubscription(stripeSubscriptionToRow(stripeSub()));
  const del = createDeleteAccount({ db, stripe: fakeStripe({}, log) });
  assert.equal((await del(req('/d', { method: 'POST', body: { confirm: true } }))).status, 401);
  assert.equal((await del(req('/d', { method: 'POST', headers: { authorization: 'Bearer token-1' }, body: {} }))).status, 400);
  const res = await del(req('/d', { method: 'POST', headers: { authorization: 'Bearer token-1' }, body: { confirm: true } }));
  assert.equal(res.status, 200); assert.deepEqual(log[0], ['cancel', 'sub_1']);
  assert.deepEqual(db.state.deleted, ['user-1']); assert.deepEqual(db.state.links, {}); assert.equal(db.state.subs[0].user_id, null); assert.equal(db.state.subs[0].status, 'expired');
});

test('Conversions : Stripe et RevenueCat vers une ligne d\'abonnement', () => {
  assert.equal(stripeSubscriptionToRow(stripeSub({ status: 'past_due' })).status, 'grace');
  assert.equal(stripeSubscriptionToRow(stripeSub({ status: 'unpaid' })).status, 'expired');
  assert.equal(stripeSubscriptionToRow({ ...stripeSub(), current_period_end: 1800000000, items: { data: [] } }).current_period_end, new Date(1800000000000).toISOString());
  assert.equal(revenueCatEventToRow(rcEvent({ type: 'TEST' })), null);
  assert.equal(revenueCatEventToRow(rcEvent({ type: 'BILLING_ISSUE', period_type: 'NORMAL', grace_period_expiration_at_ms: Date.now() + 86400000 })).status, 'grace');
  assert.equal(revenueCatEventToRow(rcEvent({ type: 'CANCELLATION', cancel_reason: 'CUSTOMER_SUPPORT' })).status, 'expired');
  const row = revenueCatSubscriberToRow('device-x', { original_app_user_id: 'device-x', entitlements: { premium: { product_identifier: 'tarikh_premium_monthly', expires_date: new Date(Date.now() + 86400000).toISOString() } }, subscriptions: { tarikh_premium_monthly: { period_type: 'trial', is_sandbox: true } } });
  assert.equal(row.status, 'trialing'); assert.equal(row.environment, 'sandbox');
  assert.equal(revenueCatSubscriberToRow('device-x', { entitlements: {} }), null);
});

test('Cron et génération : protégés par CRON_SECRET', async () => {
  const db = fakeDb();
  const cron = createCron({ db, notify: async () => ({ fr: 200 }) });
  assert.equal((await cron(req('/api/cron-daily'))).status, 401);
  assert.equal((await cron(req('/api/cron-daily', { headers: { authorization: 'Bearer nope' } }))).status, 401);
  assert.equal((await createGenerate({ db })(req('/api/generate', { method: 'POST', body: {} }))).status, 401);
  const ok = await cron(req('/api/cron-daily', { headers: { authorization: `Bearer ${process.env.CRON_SECRET}` } }));
  assert.equal(ok.status, 200);
  const out = await ok.json();
  assert.equal(out.days.length, 2); assert.ok(out.days.every((d) => d.story === 'seed'));
  assert.equal(db.state.stories.length, 12); assert.equal(db.state.reminders.length, 12);
  assert.equal(new Set(db.state.stories.map((s) => s.topic_key)).size, 2);
  // Second passage (cron de secours) : rien n'est recréé, pas de seconde notification.
  const again = await (await cron(req('/api/cron-daily?rescue=1', { headers: { authorization: `Bearer ${process.env.CRON_SECRET}` } }))).json();
  assert.ok(again.days.every((d) => d.story === 'exists')); assert.equal(db.state.stories.length, 12); assert.ok(again.push.skipped);
});

test('Diagnostic /api/health : liste ce qui manque, détecte une clé d\'un autre projet, ne révèle aucune valeur', async () => {
  const { diagnose } = await import('../api/health.js');
  const jwt = (ref) => `x.${Buffer.from(JSON.stringify({ ref, role: 'service_role' })).toString('base64url')}.y`;
  const saved = { ...process.env };
  try {
    for (const k of ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_SERVICE_KEY', 'ANTHROPIC_KEY', 'STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET', 'STRIPE_PRICE_ID', 'REVENUECAT_WEBHOOK_SECRET', 'REVENUECAT_SECRET_API_KEY', 'ONESIGNAL_REST_API_KEY', 'ONESIGNAL_REST_KEY', 'ONESIGNAL_APP_ID', 'PUBLIC_SITE_URL']) delete process.env[k];
    const empty = await diagnose({ fetchImpl: async () => ({ ok: true, status: 200 }) });
    assert.equal(empty.ok, false); assert.ok(empty.features.database.need.includes('SUPABASE_SERVICE_ROLE_KEY')); assert.deepEqual(empty.features.payments_web_stripe.need.sort(), ['STRIPE_PRICE_ID', 'STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET']);
    process.env.SUPABASE_URL = 'https://newprojectref.supabase.co'; process.env.SUPABASE_ANON_KEY = 'anon-value';
    process.env.SUPABASE_SERVICE_KEY = jwt('oldprojectref'); // ancien nom de variable, clé d'un autre projet
    const wrong = await diagnose({ fetchImpl: async () => ({ ok: true, status: 200 }) });
    assert.equal(wrong.features.database.ok, false); assert.match(wrong.features.database.problems.join(' '), /AUTRE projet/);
    process.env.SUPABASE_SERVICE_ROLE_KEY = jwt('newprojectref');
    const good = await diagnose({ fetchImpl: async () => ({ ok: true, status: 200 }) });
    assert.equal(good.features.database.ok, true); assert.equal(good.supabase_project, 'newprojectref');
    const nosql = await diagnose({ fetchImpl: async () => ({ ok: false, status: 404 }) });
    assert.equal(nosql.database, 'schema_missing');
    assert.ok(!JSON.stringify(good).includes('anon-value') && !JSON.stringify(good).includes('oldprojectref'));
  } finally { for (const k of Object.keys(process.env)) if (!(k in saved)) delete process.env[k]; Object.assign(process.env, saved); }
});
