// Test de bout en bout dans Chromium (Playwright) : npm run test:e2e
// Vérifie : aucune erreur console, 3 onglets, tous les outils, 6 langues (dont RTL), Qibla sur 3 villes,
// hors-ligne, accès Premium (serveur simulé), écran d'abonnement.
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const { chromium, devices } = createRequire(import.meta.url)('playwright');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const PORT = 4188, BASE = `http://localhost:${PORT}`;
const read = (p) => JSON.parse(fs.readFileSync(path.join(root, p), 'utf8'));

const server = spawn(process.execPath, [path.join(root, 'scripts/serve.mjs'), String(PORT)], { stdio: 'ignore' });
const stop = () => { try { server.kill(); } catch { /* déjà arrêté */ } };
process.on('exit', stop);
for (let i = 0; i < 50; i++) { try { if ((await fetch(BASE + '/manifest.json')).ok) break; } catch { /* pas prêt */ } await new Promise((r) => setTimeout(r, 100)); }

const results = [];
const errors = [];
let failed = 0;
async function step(name, fn) {
  const before = errors.length;
  try {
    await fn();
    if (errors.length > before) throw new Error('erreur console : ' + errors.slice(before).join(' | '));
    results.push(`ok   ${name}`);
  } catch (err) { failed++; results.push(`FAIL ${name}\n       ${String(err.message).split('\n')[0]}`); }
}
const expect = (cond, msg) => { if (!cond) throw new Error(msg); };

const browser = await chromium.launch();
async function newPage({ premium = false, lang = 'fr-FR', store = {} } = {}) {
  const ctx = await browser.newContext({ ...devices['iPhone 14'], locale: lang, timezoneId: 'Europe/Paris', serviceWorkers: 'allow' });
  await ctx.addInitScript((s) => { for (const [k, v] of Object.entries(s)) if (localStorage.getItem('tarikh:' + k) == null) localStorage.setItem('tarikh:' + k, JSON.stringify(v)); }, { onboarded: true, splashSeen: new Date().toDateString(), ...store });
  if (premium) {
    await ctx.route('**/api/subscription-status*', (r) => r.fulfill({ json: { premium: true, source: 'stripe', status: 'trialing', current_period_end: new Date(Date.now() + 6 * 86400000).toISOString() } }));
    await ctx.route('**/api/premium-content*', (r) => {
      const u = new URL(r.request().url()); const kind = u.searchParams.get('kind'), l = u.searchParams.get('lang');
      const data = kind === 'history' ? [] : read(`content/premium/${kind}/${l}.json`);
      r.fulfill({ json: { kind, lang: l, data } });
    });
  }
  const page = await ctx.newPage();
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  return { ctx, page };
}
const openTool = async (page, name) => { await page.evaluate((n) => { location.hash = '#/tool/' + n; }, name); await page.waitForSelector('#sheet.open'); await page.waitForFunction(() => !document.querySelector('#sheet-body .loading')); };
const closeSheet = async (page) => { await page.keyboard.press('Escape'); await page.waitForFunction(() => document.getElementById('sheet').hidden); };
const PARIS = { lat: 48.857, lon: 2.352, name: 'Paris', country: 'FR', source: 'city' };

// ---------- 1. Premier lancement ----------
await step('Premier lancement : écran de démarrage puis accueil en 3 étapes', async () => {
  const { ctx, page } = await newPage({ store: { onboarded: false, splashSeen: 'x' } });
  await ctx.addInitScript(() => { localStorage.removeItem('tarikh:onboarded'); });
  await page.goto(BASE + '/');
  expect(await page.locator('#splash').isVisible(), 'splash absent');
  const origin = await page.evaluate(() => getComputedStyle(document.querySelector('.hand-hour')).transformOrigin);
  expect(/^100px 100px/.test(origin), `aiguilles mal centrées : ${origin}`);
  await page.waitForSelector('#onboarding:not([hidden])', { timeout: 6000 });
  expect((await page.locator('.lang-grid button').count()) === 6, '6 langues attendues');
  await page.click('.lang-grid button[data-lang="en"]');
  expect((await page.locator('#onboarding h1').textContent()).includes('Islamic history'), 'langue non appliquée');
  await page.click('.lang-grid button[data-lang="fr"]');
  await page.click('#ob-next');
  await page.fill('#city-search', 'Jakar');
  await page.click('#onboarding .list-item');
  await page.waitForSelector('#ob-next');
  await page.click('#ob-next');
  await page.waitForFunction(() => document.getElementById('onboarding').hidden);
  expect((await page.evaluate(() => JSON.parse(localStorage.getItem('tarikh:settings')).method)) === 'kemenag', 'méthode régionale non appliquée');
  await ctx.close();
});

// ---------- 2. Aujourd'hui ----------
const { ctx, page } = await newPage({ store: { location: PARIS, settings: { method: 'uoif', asr: 'standard', hijriAdjust: 0 } } });
await step("Aujourd'hui : série, horaires (6), rappel avec référence, histoire du jour", async () => {
  await page.goto(BASE + '/');
  await page.waitForSelector('#story-card');
  expect((await page.locator('.prayer-row').count()) === 6, '6 horaires attendus');
  expect((await page.locator('.prayer-row.next').count()) <= 1, 'une seule prochaine prière');
  expect(/^\d\d:\d\d:\d\d$/.test(await page.locator('#prayer-countdown').textContent()), 'compte à rebours invalide');
  const t1 = await page.locator('#prayer-countdown').textContent();
  await page.waitForTimeout(1200);
  expect((await page.locator('#prayer-countdown').textContent()) !== t1, 'compte à rebours figé');
  expect((await page.locator('.streak').textContent()).includes('1'), 'série absente');
  const reminder = await page.locator('section[aria-label="Rappel du jour"]').textContent();
  expect(/Bukhari|Muslim/i.test(reminder), 'rappel sans référence');
  expect((await page.locator('#story-card .title').textContent()).length > 5, 'titre absent');
});
await step('Histoire : lecture complète, leçon, favori réservé au Premium, fermeture par Échap', async () => {
  await page.click('#btn-read-story');
  await page.waitForSelector('#sheet.open');
  expect((await page.locator('#sheet .story-text p').count()) >= 3, 'récit incomplet');
  expect((await page.locator('#sheet .lesson').count()) === 1, 'leçon absente');
  await closeSheet(page);
  expect((await page.locator('.streak').textContent()).includes('1'), 'bonne action non comptée');
  expect((await page.evaluate(() => Object.values(JSON.parse(localStorage.getItem('tarikh:deeds') || '{}'))[0])) === 1, 'hassanette de lecture non enregistrée');
});

// ---------- 3. Outils ----------
const FREE = ['tasbih', 'qibla', 'names', 'duas', 'adhkar', 'deeds', 'zakat', 'prayers', 'fasting', 'ramadan'];
for (const tool of [...FREE, 'prophets', 'hajj', 'quiz', 'history', 'favorites']) {
  await step(`Outil « ${tool} » s'ouvre sans erreur`, async () => {
    await openTool(page, tool);
    expect((await page.locator('#sheet-body .error-box').count()) === 0, 'erreur affichée');
    expect((await page.locator('#sheet-body').innerText()).trim().length > 20, 'outil vide');
    expect(!/\b[a-z]+\.[a-zA-Z0-9.-]+\b/.test((await page.locator('#sheet-title').textContent()) || ''), 'clé de traduction brute dans le titre');
    await closeSheet(page);
  });
}
await step('Tasbih : compte, série de 33 terminée -> bonne action', async () => {
  await openTool(page, 'tasbih');
  for (let i = 0; i < 3; i++) await page.click('#tasbih-tap');
  expect((await page.locator('.tasbih-count').textContent()) === '3', 'compteur faux');
  for (let i = 0; i < 30; i++) await page.click('#tasbih-tap');
  expect((await page.evaluate(() => JSON.parse(localStorage.getItem('tarikh:tasbih:total')))) === 33, 'total faux');
  await closeSheet(page);
});
await step('99 Noms : 99 entrées et recherche', async () => {
  await openTool(page, 'names');
  expect((await page.locator('.name-card').count()) === 99, '99 noms attendus');
  await page.fill('#sheet-body input[type=search]', 'rahman');
  expect((await page.locator('.name-card').count()) >= 1 && (await page.locator('.name-card').count()) < 5, 'recherche inefficace');
  await closeSheet(page);
});
await step('Douaas (≥ 30) et Adhkar (4 sections avec compteurs)', async () => {
  await openTool(page, 'duas');
  expect((await page.locator('.dua-card').count()) >= 30, 'moins de 30 douaas');
  await closeSheet(page);
  await openTool(page, 'adhkar');
  expect((await page.locator('#sheet-body .seg button').count()) === 4, '4 sections attendues');
  const pill = page.locator('.counter-pill').first();
  const before = await pill.textContent();
  await pill.click();
  expect((await pill.textContent()) !== before, 'compteur adhkar figé');
  await closeSheet(page);
});
await step('Zakat : 2,5 % au-dessus du nisab, 0 en dessous', async () => {
  await openTool(page, 'zakat');
  await page.fill('input[data-z="price"]', '60');
  await page.fill('input[data-z="cash"]', '10000');
  expect((await page.locator('#zakat-due').textContent()).replace(/\s/g, '') === '250', 'zakat attendue : 250');
  await page.fill('input[data-z="cash"]', '1000');
  expect((await page.locator('#zakat-due').textContent()).trim() === '0', 'zakat attendue : 0');
  await closeSheet(page);
});
await step('Suivi des prières et du jeûne', async () => {
  await openTool(page, 'prayers');
  await page.click('input[data-prayer="fajr"]');
  expect((await page.locator('.day-dot.part').count()) === 1, 'jour partiel non marqué');
  await closeSheet(page);
  await openTool(page, 'fasting');
  await page.locator('.day-dot').nth(2).click();
  expect((await page.locator('#fast-count').textContent()) === '1/30', 'jeûne non compté');
  await closeSheet(page);
});
for (const [city, lat, lon, expected] of [['Paris', 48.8566, 2.3522, 119], ['Jakarta', -6.2088, 106.8456, 295], ['New York', 40.7128, -74.006, 58]]) {
  await step(`Qibla ${city} ≈ ${expected}°`, async () => {
    await page.evaluate((loc) => localStorage.setItem('tarikh:location', JSON.stringify(loc)), { lat, lon, name: city, country: '', source: 'city' });
    await openTool(page, 'qibla');
    const deg = parseInt(await page.locator('#qibla-deg').textContent(), 10);
    expect(Math.abs(deg - expected) <= 1, `obtenu ${deg}°`);
    await closeSheet(page);
  });
}
await page.evaluate((loc) => localStorage.setItem('tarikh:location', JSON.stringify(loc)), PARIS);

// ---------- 4. Onglets ----------
await step('Calendrier : mois hégirien, jours colorés, détail au clic, navigation', async () => {
  await page.click('#tab-calendar');
  await page.waitForSelector('.cal-day.today');
  const n = await page.locator('.cal-day:not(.cal-empty)').count();
  expect(n === 29 || n === 30, `mois de ${n} jours`);
  expect((await page.locator('.cal-day.fast').count()) >= 6, 'jours de jeûne non signalés');
  await page.locator('.cal-day.fast').first().click();
  expect((await page.locator('#cal-detail').innerText()).length > 20, 'détail vide');
  const title = await page.locator('.cal-head h1').textContent();
  await page.click('.cal-head .icon-btn >> nth=1');
  await page.waitForFunction((t) => document.querySelector('.cal-head h1').textContent !== t, title);
});
await step("Onglet Premium : prix, durée, renouvellement, liens légaux, restauration (aucun accès sans abonnement)", async () => {
  await page.click('#tab-premium');
  await page.waitForSelector('#premium-price');
  const text = await page.locator('#view-premium').innerText();
  expect(/4,99/.test(text) && /mois/.test(text), 'prix ou durée absents');
  expect(/7 jours/.test(text), 'essai absent');
  expect(/[Rr]enouvellement automatique/.test(text), 'mention de renouvellement absente');
  expect((await page.locator('#view-premium a[href$="terms.html"]').count()) === 1 && (await page.locator('#view-premium a[href$="privacy.html"]').count()) === 1, 'liens légaux absents');
  expect(await page.locator('#btn-restore').isVisible(), 'bouton Restaurer absent');
  await page.evaluate(() => localStorage.setItem('tarikh:premiumCache', JSON.stringify({ active: true, at: Date.now() })));
  await openTool(page, 'prophets');
  await page.locator('[data-prophet="nuh"]').click();
  await page.waitForFunction(() => location.hash === '#/paywall');
  await closeSheet(page);
  await page.evaluate(() => localStorage.removeItem('tarikh:premiumCache'));
});
await step('Paramètres : toutes les sections, export des données', async () => {
  await page.click('#btn-settings');
  await page.waitForSelector('#sheet.open');
  expect((await page.locator('#sheet-body section.card').count()) >= 8, 'sections manquantes');
  expect(await page.locator('#btn-export').isVisible() && await page.locator('#btn-erase').isVisible(), 'export/effacement absents');
  expect(/IA|intelligence artificielle/.test(await page.locator('#sheet-body').innerText()), "mention de l'IA absente");
  await closeSheet(page);
});

// ---------- 5. Langues ----------
for (const [code, dir, word] of [['en', 'ltr', 'Today'], ['ar', 'rtl', null], ['es', 'ltr', null], ['id', 'ltr', null], ['ur', 'rtl', null], ['fr', 'ltr', "Aujourd'hui"]]) {
  await step(`Langue ${code} : interface, contenu et sens d'écriture (${dir})`, async () => {
    await page.evaluate(() => { location.hash = '#/settings'; });
    await page.waitForSelector('#sheet.open');
    await page.locator('#sheet-body select').first().selectOption(code);
    await page.waitForFunction((c) => document.documentElement.lang === c, code);
    expect((await page.evaluate(() => document.documentElement.dir)) === dir, 'dir incorrect');
    await closeSheet(page);
    await page.click('#tab-today');
    await page.waitForSelector('#story-card');
    const tab = (await page.locator('#tab-today .tab-label').textContent()).trim();
    if (word) expect(tab === word, `onglet « ${tab} »`);
    if (code !== 'fr') expect(tab !== "Aujourd'hui", 'interface non traduite');
    const raw = await page.evaluate(() => [...document.querySelectorAll('#view-today *, .tabbar *, .app-header *')].filter((e) => !e.children.length && /^[a-z]+(\.[a-zA-Z0-9-]+)+$/.test(e.textContent.trim())).map((e) => e.textContent.trim()));
    expect(raw.length === 0, 'clés non traduites : ' + raw.slice(0, 5).join(', '));
    const story = await page.locator('#story-card .title').textContent();
    if (['ar', 'ur'].includes(code)) expect(/[\u0600-\u06FF]/.test(story), 'histoire non traduite');
    if (dir === 'rtl') {
      const [a, b] = await page.evaluate(() => [document.getElementById('tab-today').getBoundingClientRect().left, document.getElementById('tab-premium').getBoundingClientRect().left]);
      expect(a > b, 'navigation non inversée en RTL');
    }
    for (const tool of ['names', 'duas', 'prophets']) { await openTool(page, tool); expect((await page.locator('#sheet-body .error-box').count()) === 0, `erreur dans ${tool}`); await closeSheet(page); }
  });
}

// ---------- 6. Hors-ligne ----------
await step('Hors-ligne : rechargement, histoire, horaires et outils disponibles', async () => {
  await page.goto(BASE + '/');
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.waitForFunction(async () => (await caches.keys()).length > 0 && !!navigator.serviceWorker.controller, null, { timeout: 15000 }).catch(async () => { await page.reload(); await page.waitForFunction(() => !!navigator.serviceWorker.controller); });
  await ctx.setOffline(true);
  const before = errors.length;
  await page.reload();
  await page.waitForSelector('#story-card', { timeout: 10000 });
  expect((await page.locator('.prayer-row').count()) === 6, 'horaires absents hors-ligne');
  for (const tool of ['tasbih', 'names', 'duas', 'adhkar', 'qibla']) { await openTool(page, tool); expect((await page.locator('#sheet-body .error-box').count()) === 0, `${tool} indisponible hors-ligne`); await closeSheet(page); }
  await page.click('#tab-calendar');
  await page.waitForSelector('.cal-day.today');
  errors.splice(before); // les échecs réseau attendus hors-ligne (statut d'abonnement) ne sont pas des bugs
  await ctx.setOffline(false);
});
await ctx.close();

// ---------- 7. Abonné Premium (serveur simulé) ----------
await step('Premium : 25 prophètes avec références, guide Hajj, quiz de 10 questions, onglet Historique', async () => {
  const { ctx: c2, page: p } = await newPage({ premium: true, store: { location: PARIS } });
  await p.goto(BASE + '/');
  await p.waitForFunction(() => document.getElementById('btn-premium').classList.contains('is-premium'));
  expect((await p.locator('#tab-premium-label').textContent()).trim() === 'Historique', "l'onglet devrait devenir Historique");
  await openTool(p, 'prophets');
  expect((await p.locator('[data-prophet]').count()) === 25, '25 prophètes attendus');
  await p.locator('[data-prophet="yusuf"]').click();
  await p.waitForSelector('#sheet-body article');
  expect((await p.locator('#sheet-body .story-text').innerText()).split(/\s+/).length >= 280, 'récit trop court');
  expect((await p.locator('#sheet-body .chip').count()) >= 2, 'références coraniques absentes');
  await closeSheet(p);
  await openTool(p, 'hajj');
  expect((await p.locator('#sheet-body details').count()) >= 5, 'chapitres absents');
  await p.locator('#sheet-body .seg button').nth(3).click();
  expect((await p.locator('#sheet-body .check').count()) >= 20, 'checklist absente');
  await closeSheet(p);
  await openTool(p, 'quiz');
  await p.locator('[data-cat="all"]').click();
  for (let i = 0; i < 10; i++) { await p.locator('.quiz-opt').first().click(); await p.locator('#sheet-body .btn.primary:not([hidden])').click(); }
  expect(/^\d+ \/ 10$/.test(await p.locator('#quiz-score').textContent()), 'score absent');
  await closeSheet(p);
  await p.click('#tab-calendar');
  await p.click('#tab-premium');
  await p.waitForSelector('#view-premium .card');
  expect((await p.locator('#view-premium').innerText()).length > 30, 'espace abonné vide');
  await c2.close();
});

await browser.close();
stop();
console.log(results.join('\n'));
console.log(`\n${results.length - failed}/${results.length} étapes réussies`);
process.exit(failed ? 1 : 0);
