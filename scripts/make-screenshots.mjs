// Captures d'écran App Store générées automatiquement (Playwright) : 6 écrans × 2 langues × 2 tailles.
// 6,9 pouces : 1320 × 2868   |   6,5 pouces : 1284 × 2778
// Usage : npm run screenshots   (lance le build puis ce script) -> appstore/screenshots/<lang>/<taille>/
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const { chromium } = createRequire(import.meta.url)('playwright');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 4199, BASE = `http://localhost:${PORT}`;
const read = (p) => JSON.parse(fs.readFileSync(path.join(root, p), 'utf8'));
const b64 = (f, type) => `data:${type};base64,${fs.readFileSync(path.join(root, f)).toString('base64')}`;

const SIZES = { '6.9': [1320, 2868], '6.5': [1284, 2778] };
const CAPTIONS = {
  fr: ["Une histoire vraie,\nchaque jour", 'Des récits vérifiés,\nune leçon à retenir', 'Vos horaires de prière,\nmême hors-ligne', 'La Qibla,\noù que vous soyez', 'Le calendrier hégirien\net les jours de jeûne', 'Les 25 prophètes,\nle Hajj, le quiz'],
  en: ['A true story,\nevery day', 'Fact-checked stories,\na lesson to keep', 'Your prayer times,\neven offline', 'The Qibla,\nwherever you are', 'The Hijri calendar\nand fasting days', 'The 25 prophets,\nHajj, the quiz'],
};
const CITY = { fr: { lat: 48.857, lon: 2.352, name: 'Paris', country: 'FR', source: 'city' }, en: { lat: 51.507, lon: -0.128, name: 'London', country: 'GB', source: 'city' } };

const server = spawn(process.execPath, [path.join(root, 'scripts/serve.mjs'), String(PORT)], { stdio: 'ignore' });
process.on('exit', () => { try { server.kill(); } catch { /* déjà arrêté */ } });
for (let i = 0; i < 50; i++) { try { if ((await fetch(BASE + '/manifest.json')).ok) break; } catch { /* pas prêt */ } await new Promise((r) => setTimeout(r, 100)); }

const browser = await chromium.launch();
const fonts = `@font-face{font-family:PF;src:url("${b64('node_modules/@fontsource/playfair-display/files/playfair-display-latin-700-normal.woff2', 'font/woff2')}") format("woff2");font-weight:700}`;

async function capture(lang) {
  const ctx = await browser.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 3, locale: lang === 'fr' ? 'fr-FR' : 'en-GB', timezoneId: lang === 'fr' ? 'Europe/Paris' : 'Europe/London', isMobile: true, hasTouch: true });
  await ctx.addInitScript(([l, city]) => {
    const set = (k, v) => localStorage.setItem('tarikh:' + k, JSON.stringify(v));
    set('lang', l); set('onboarded', true); set('splashSeen', new Date().toDateString()); set('location', city);
    set('settings', { method: l === 'fr' ? 'uoif' : 'mwl', asr: 'standard', hijriAdjust: 0 });
    const d = new Date(); const key = (x) => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
    const y = new Date(d); y.setDate(d.getDate() - 1);
    set('streak', { last: key(y), count: 6, best: 12 }); set('deeds', { [key(d)]: 4 }); set('deeds:total', 87);
  }, [lang, CITY[lang]]);
  await ctx.route('**/api/subscription-status*', (r) => r.fulfill({ json: { premium: false } }));
  const page = await ctx.newPage();
  const shots = [];
  const snap = async () => { await page.waitForTimeout(450); shots.push(await page.screenshot({ type: 'png' })); };
  await page.goto(BASE + '/');
  await page.waitForSelector('#story-card');
  await page.waitForFunction(() => !document.getElementById('splash'));
  await page.evaluate(() => document.fonts.ready);
  await snap();                                                                    // 1. Aujourd'hui
  await page.click('#btn-read-story'); await page.waitForSelector('#sheet.open'); await snap();   // 2. Histoire
  await page.keyboard.press('Escape'); await page.waitForFunction(() => document.getElementById('sheet').hidden);
  await page.evaluate(() => document.getElementById('prayer-card').scrollIntoView({ block: 'start' })); await page.evaluate(() => window.scrollBy(0, -70)); await snap(); // 3. Prières
  await page.evaluate(() => { location.hash = '#/tool/qibla'; }); await page.waitForSelector('.compass'); await snap();   // 4. Qibla
  await page.keyboard.press('Escape'); await page.waitForFunction(() => document.getElementById('sheet').hidden);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.click('#tab-calendar'); await page.waitForSelector('.cal-day.today'); await snap();     // 5. Calendrier
  await ctx.close();

  // 6. Prophètes (abonné, contenu servi par un faux serveur local)
  const ctx2 = await browser.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 3, locale: lang === 'fr' ? 'fr-FR' : 'en-GB', isMobile: true, hasTouch: true });
  await ctx2.addInitScript(([l]) => { const set = (k, v) => localStorage.setItem('tarikh:' + k, JSON.stringify(v)); set('lang', l); set('onboarded', true); set('splashSeen', new Date().toDateString()); set('prophetsRead', ['adam', 'idris', 'nuh', 'hud', 'salih', 'ibrahim']); }, [lang]);
  await ctx2.route('**/api/subscription-status*', (r) => r.fulfill({ json: { premium: true, source: 'apple', status: 'active' } }));
  await ctx2.route('**/api/premium-content*', (r) => r.fulfill({ json: { data: read(`content/premium/prophets/${lang}.json`) } }));
  const p2 = await ctx2.newPage();
  await p2.goto(BASE + '/');
  await p2.waitForFunction(() => document.getElementById('btn-premium').classList.contains('is-premium') && !document.getElementById('splash'));
  await p2.evaluate(() => { location.hash = '#/tool/prophets'; });
  await p2.waitForSelector('[data-prophet]');
  await p2.waitForTimeout(450);
  shots.push(await p2.screenshot({ type: 'png' }));
  await ctx2.close();
  return shots;
}

async function compose(shot, caption, [W, H], file) {
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  const phoneW = Math.round(W * 0.8), phoneH = Math.round(phoneW * (852 / 393));
  await page.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>${fonts}
    html,body{margin:0;width:${W}px;height:${H}px;overflow:hidden;background:radial-gradient(ellipse at 50% 0%,#2a1c06 0%,#080400 60%)}
    h1{font-family:PF,Georgia,serif;font-weight:700;color:#E8D9A8;font-size:${Math.round(W * 0.082)}px;line-height:1.16;text-align:center;margin:0;padding:${Math.round(H * 0.058)}px ${Math.round(W * 0.06)}px 0;white-space:pre-line}
    .rule{width:${Math.round(W * 0.1)}px;height:5px;background:#C9A84C;margin:${Math.round(H * 0.018)}px auto 0;border-radius:3px}
    .phone{position:absolute;left:50%;top:${Math.round(H * 0.235)}px;width:${phoneW}px;height:${phoneH}px;margin-left:${-phoneW / 2}px;border-radius:${Math.round(W * 0.075)}px;overflow:hidden;border:${Math.round(W * 0.008)}px solid #9B7E3A;box-shadow:0 40px 120px rgba(0,0,0,.7);box-sizing:border-box;background:#080400}
    .phone img{width:100%;display:block}</style></head>
    <body><h1>${caption.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</h1><div class="rule"></div><div class="phone"><img src="data:image/png;base64,${shot.toString('base64')}"></div></body></html>`);
  await page.evaluate(async () => { await document.fonts.load('700 80px PF'); await document.fonts.ready; await Promise.all([...document.images].map((i) => i.decode())); });
  fs.mkdirSync(path.dirname(file), { recursive: true });
  await page.screenshot({ path: file, type: 'png' });
  await page.close();
}

for (const lang of Object.keys(CAPTIONS)) {
  const shots = await capture(lang);
  for (const [size, dims] of Object.entries(SIZES)) {
    for (let i = 0; i < shots.length; i++) {
      const file = path.join(root, 'appstore/screenshots', lang, size, `${String(i + 1).padStart(2, '0')}.png`);
      await compose(shots[i], CAPTIONS[lang][i], dims, file);
    }
  }
  console.log(`ok ${lang} : ${shots.length} écrans × ${Object.keys(SIZES).length} tailles`);
}
await browser.close();
server.kill();
