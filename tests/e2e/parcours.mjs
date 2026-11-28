// Parcours d'achat et de compte (web) + comportement en mode iOS natif simulé. Lancé par `npm run test:e2e`.
// Tous les serveurs (Supabase Auth, API Tarikh, Stripe) sont simulés : aucune vraie requête, aucune vraie clé.
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const { chromium, devices } = createRequire(import.meta.url)('playwright');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const PORT = 4189, BASE = `http://localhost:${PORT}`;
const server = spawn(process.execPath, [path.join(root, 'scripts/serve.mjs'), String(PORT)], { stdio: 'ignore' });
const stop = () => { try { server.kill(); } catch { /* déjà arrêté */ } };
process.on('exit', stop);
for (let i = 0; i < 50; i++) { try { if ((await fetch(BASE + '/manifest.json')).ok) break; } catch { /* pas prêt */ } await new Promise((r) => setTimeout(r, 100)); }

const results = [], errors = [];
let failed = 0;
async function step(name, fn) {
  const before = errors.length;
  try { await fn(); if (errors.length > before) throw new Error('erreur console : ' + errors.slice(before).join(' | ')); results.push(`ok   ${name}`); }
  catch (err) { failed++; results.push(`FAIL ${name}\n       ${String(err.message).split('\n')[0]}`); }
}
const expect = (c, m) => { if (!c) throw new Error(m); };
const browser = await chromium.launch();
const TEST_CONFIG = (extra = {}) => `window.TARIKH_CONFIG=${JSON.stringify({ supabaseUrl: 'https://test.supabase.co', supabaseAnonKey: 'anon-test', oneSignalAppId: '', revenueCatIosKey: '', siteUrl: BASE, version: '1.0.0', ...extra })};`;

async function newCtx({ native = false, store = {}, config = {} } = {}) {
  const ctx = await browser.newContext({ ...devices['iPhone 14'], locale: 'fr-FR', timezoneId: 'Europe/Paris', serviceWorkers: 'block' });
  await ctx.addInitScript(([s, nat]) => {
    for (const [k, v] of Object.entries(s)) localStorage.setItem('tarikh:' + k, JSON.stringify(v));
    // Capacitor détecte iOS grâce à ce pont natif : on le simule (les plugins n'y répondent pas).
    if (nat) window.webkit = { messageHandlers: { bridge: { postMessage() {} } } };
  }, [{ onboarded: true, splashSeen: new Date().toDateString(), location: { lat: 48.857, lon: 2.352, name: 'Paris', country: 'FR', source: 'city' }, ...store }, native]);
  await ctx.route('**/config.js', (r) => r.fulfill({ contentType: 'text/javascript', body: TEST_CONFIG(config) }));
  const page = await ctx.newPage();
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
  // Le pont iOS simulé n'implémente aucun plugin : sur un vrai iPhone ils existent. On ignore ce seul message.
  page.on('pageerror', (e) => { if (!/plugin is not implemented on ios/.test(e.message)) errors.push('pageerror: ' + e.message); });
  return { ctx, page };
}
const SESSION = { access_token: 'tok-abc', refresh_token: 'ref-abc', expires_at: Math.floor(Date.now() / 1000) + 3600, user: { id: 'user-1', email: 'test@example.com' } };

// ---------- Web : visiteur sans compte ----------
await step("Web : « S'abonner » sans compte ouvre la connexion, pas le paiement", async () => {
  const { ctx, page } = await newCtx();
  let checkoutCalls = 0;
  await ctx.route('**/api/subscription-status*', (r) => r.fulfill({ json: { premium: false } }));
  await ctx.route('**/api/create-checkout-session', (r) => { checkoutCalls++; r.fulfill({ json: { url: 'https://checkout.stripe.com/x' } }); });
  await page.goto(BASE + '/#/premium');
  await page.waitForSelector('#btn-subscribe:not([disabled])');
  expect(/7 jours/.test(await page.locator('#view-premium').innerText()), 'essai de 7 jours absent');
  await page.click('#btn-subscribe');
  await page.waitForSelector('#sheet.open');
  expect((await page.locator('#sheet-title').textContent()).includes('Compte'), 'écran de connexion attendu');
  expect(checkoutCalls === 0, 'paiement lancé sans compte');
  await ctx.close();
});

// ---------- Web : connexion par code, paiement Stripe, retour ----------
await step('Web : code par e-mail -> connexion -> liaison appareil -> paiement Stripe (essai 7 jours)', async () => {
  const { ctx, page } = await newCtx();
  const calls = [];
  await ctx.route('**/api/subscription-status*', (r) => r.fulfill({ json: { premium: false } }));
  await ctx.route('https://test.supabase.co/auth/v1/otp', (r) => { calls.push(['otp', r.request().postDataJSON()]); r.fulfill({ json: {} }); });
  await ctx.route('https://test.supabase.co/auth/v1/verify', (r) => { calls.push(['verify', r.request().postDataJSON()]); r.fulfill({ json: { access_token: 'tok-abc', refresh_token: 'ref-abc', expires_in: 3600, user: { id: 'user-1', email: 'test@example.com' } } }); });
  await ctx.route('**/api/link-device', (r) => { calls.push(['link', r.request().headers().authorization]); r.fulfill({ json: { linked: true } }); });
  await ctx.route('**/api/create-checkout-session', (r) => { calls.push(['checkout', r.request().headers().authorization, r.request().postDataJSON()]); r.fulfill({ json: { url: 'https://checkout.stripe.com/c/pay/test' } }); });
  await ctx.route('https://checkout.stripe.com/**', (r) => r.fulfill({ contentType: 'text/html', body: '<h1>Stripe test</h1>' }));
  await page.goto(BASE + '/#/premium');
  await page.waitForSelector('#btn-subscribe:not([disabled])');
  await page.click('#btn-subscribe');
  await page.waitForSelector('#sheet.open');
  await page.getByLabel('Adresse e-mail').fill('test@example.com');
  await page.getByRole('button', { name: 'Recevoir un code par e-mail' }).click();
  await page.getByLabel('Code reçu par e-mail').fill('123456');
  await page.getByRole('button', { name: 'Valider le code' }).click();
  await page.waitForFunction(() => !!localStorage.getItem('tarikh:session'));
  // Après la connexion : retour à l'écran d'abonnement (feuille), identifiants distincts de l'onglet.
  await page.waitForSelector('#btn-subscribe-sheet:not([disabled])');
  expect((await page.locator('#btn-subscribe').count()) <= 1 && (await page.locator('#btn-subscribe-sheet').count()) === 1, 'identifiants HTML en double');
  await page.click('#btn-subscribe-sheet');
  await page.waitForURL('https://checkout.stripe.com/**');
  const byName = Object.fromEntries(calls.map((c) => [c[0], c]));
  expect(byName.otp[1].email === 'test@example.com' && byName.otp[1].create_user === true, 'demande de code incorrecte');
  expect(byName.verify[1].token === '123456' && byName.verify[1].type === 'email', 'vérification incorrecte');
  expect(byName.link[1] === 'Bearer tok-abc', 'appareil non relié avec le jeton');
  expect(byName.checkout[1] === 'Bearer tok-abc' && byName.checkout[2].lang === 'fr', 'paiement sans jeton ou sans langue');
  await ctx.close();
});
await step('Web : retour de Stripe (?checkout=success) -> abonnement activé, message de bienvenue', async () => {
  const { ctx, page } = await newCtx({ store: { session: SESSION } });
  let refreshed = false;
  await ctx.route('**/api/subscription-status*', (r) => { const u = new URL(r.request().url()); if (u.searchParams.get('refresh') === '1') refreshed = true; r.fulfill({ json: { premium: true, source: 'stripe', status: 'trialing', current_period_end: new Date(Date.now() + 6 * 86400000).toISOString() } }); });
  await page.goto(BASE + '/?checkout=success#/premium');
  await page.waitForFunction(() => document.getElementById('btn-premium').classList.contains('is-premium'));
  await page.waitForFunction(() => document.getElementById('toast').classList.contains('show') && /Bienvenue/.test(document.getElementById('toast').textContent));
  expect(refreshed, 'resynchronisation demandée au serveur');
  expect(!/checkout=/.test(page.url()), "paramètre de retour non nettoyé de l'adresse");
  expect(/Essai gratuit en cours/.test(await page.locator('#view-premium').innerText()), 'état « essai » absent');
  await ctx.close();
});
await step("Web : suppression du compte (confirmation, appel serveur, session effacée)", async () => {
  const { ctx, page } = await newCtx({ store: { session: SESSION } });
  let body = null;
  await ctx.route('**/api/subscription-status*', (r) => r.fulfill({ json: { premium: false } }));
  await ctx.route('https://test.supabase.co/auth/v1/logout', (r) => r.fulfill({ json: {} }));
  await ctx.route('**/api/delete-account', (r) => { body = { auth: r.request().headers().authorization, data: r.request().postDataJSON() }; r.fulfill({ json: { deleted: true } }); });
  let confirmText = '';
  page.on('dialog', (d) => { confirmText = d.message(); d.accept(); });
  await page.goto(BASE + '/#/settings');
  await page.waitForSelector('#btn-delete-account');
  await page.click('#btn-delete-account');
  await page.waitForFunction(() => !localStorage.getItem('tarikh:session'));
  expect(/définitivement/.test(confirmText), 'confirmation absente');
  expect(body && body.auth === 'Bearer tok-abc' && body.data.confirm === true, 'appel de suppression incorrect');
  expect((await page.locator('#btn-delete-account').count()) === 0, 'bouton encore visible après suppression');
  await ctx.close();
});
await step('Web : jeton expiré rafraîchi automatiquement avant un appel', async () => {
  const { ctx, page } = await newCtx({ store: { session: { ...SESSION, expires_at: Math.floor(Date.now() / 1000) - 10 } } });
  let usedToken = null, refreshCalls = 0;
  await ctx.route('https://test.supabase.co/auth/v1/token*', (r) => { refreshCalls++; r.fulfill({ json: { access_token: 'tok-new', refresh_token: 'ref-new', expires_in: 3600 } }); });
  await ctx.route('**/api/subscription-status*', (r) => { usedToken = r.request().headers().authorization; r.fulfill({ json: { premium: false } }); });
  await page.goto(BASE + '/');
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('tarikh:session') || '{}').access_token === 'tok-new');
  expect(refreshCalls === 1 && usedToken === 'Bearer tok-new', `rafraîchissement : ${refreshCalls} appel(s), jeton ${usedToken}`);
  await ctx.close();
});

// ---------- iOS natif simulé : aucune trace de paiement externe ----------
await step("iOS (simulé) : aucun mot « Stripe », « carte » ou lien de paiement ; aucun appel à /create-checkout-session", async () => {
  const { ctx, page } = await newCtx({ native: true });
  let checkoutCalls = 0, portalCalls = 0;
  await ctx.route('**/api/subscription-status*', (r) => r.fulfill({ json: { premium: false } }));
  await ctx.route('**/api/create-checkout-session', (r) => { checkoutCalls++; r.fulfill({ json: {} }); });
  await ctx.route('**/api/create-portal-session', (r) => { portalCalls++; r.fulfill({ json: {} }); });
  await page.goto(BASE + '/#/premium');
  await page.waitForFunction(() => document.body.classList.contains('native'));
  await page.waitForSelector('#btn-restore');
  const premiumText = await page.locator('#view-premium').innerText();
  expect(!/stripe|carte|paypal|checkout/i.test(premiumText), 'mot interdit sur l\'écran d\'abonnement iOS : ' + premiumText.match(/stripe|carte|paypal|checkout/i));
  expect(/App Store|compte Apple|Abonnements/i.test(premiumText), 'mentions Apple absentes');
  expect(await page.locator('#view-premium a[href$="terms.html"]').count() === 1 && await page.locator('#view-premium a[href$="privacy.html"]').count() === 1, 'liens légaux absents');
  const links = await page.evaluate(() => [...document.querySelectorAll('a[href]')].map((a) => a.href).filter((h) => /stripe\.com|buy\.stripe|paypal/i.test(h)));
  expect(links.length === 0, 'lien de paiement externe : ' + links.join(','));
  await page.click('#btn-subscribe').catch(() => {});
  await page.waitForTimeout(400);
  expect(checkoutCalls === 0 && portalCalls === 0, 'appel Stripe depuis iOS');
  // Paramètres : rien de Stripe non plus.
  await page.evaluate(() => { location.hash = '#/settings'; });
  await page.waitForSelector('#sheet.open');
  expect(!/stripe|buy\.stripe/i.test(await page.locator('#sheet-body').innerText()), 'Stripe visible dans les paramètres iOS');
  await ctx.close();
});
await step("iOS (simulé) : abonné Apple -> « Gérer l'abonnement » pointe vers les réglages Apple, pas vers Stripe", async () => {
  const { ctx, page } = await newCtx({ native: true });
  let portalCalls = 0, opened = null;
  await ctx.route('**/api/subscription-status*', (r) => r.fulfill({ json: { premium: true, source: 'apple', status: 'active', current_period_end: new Date(Date.now() + 20 * 86400000).toISOString() } }));
  await ctx.route('**/api/create-portal-session', (r) => { portalCalls++; r.fulfill({ json: {} }); });
  await page.addInitScript(() => { window.open = (u) => { window.__opened = u; return null; }; });
  await page.goto(BASE + '/#/premium');
  await page.waitForFunction(() => document.getElementById('btn-premium').classList.contains('is-premium'));
  await page.getByRole('button', { name: "Gérer l'abonnement" }).click();
  await page.waitForFunction(() => !!window.__opened);
  opened = await page.evaluate(() => window.__opened);
  expect(/apps\.apple\.com\/account\/subscriptions/.test(opened) && portalCalls === 0, 'mauvaise destination : ' + opened);
  await ctx.close();
});

await browser.close();
stop();
console.log(results.join('\n'));
console.log(`\n${results.length - failed}/${results.length} parcours réussis`);
process.exit(failed ? 1 : 0);
