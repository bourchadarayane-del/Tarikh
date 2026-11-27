// Génère l'icône (SVG -> PNG sans transparence), les icônes web et le splash iOS avec Playwright (Chromium).
// Usage : node scripts/make-icons.mjs
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Playwright peut être installé globalement : on le charge avec require.
const { chromium } = createRequire(import.meta.url)('playwright');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// Polices intégrées en base64 (une page sans origine ne peut pas charger de fichier local).
const dataUrl = (f) => 'data:font/woff2;base64,' + fs.readFileSync(path.join(root, f)).toString('base64');
const font = dataUrl('node_modules/@fontsource/amiri/files/amiri-arabic-700-normal.woff2');
const inter = dataUrl('node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2');

// `pad` : marge intérieure (zone de sécurité pour les icônes « maskable »).
const art = (pad = 0) => `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="100%" height="100%">
  <defs>
    <radialGradient id="glow" cx="50%" cy="38%" r="70%"><stop offset="0" stop-color="#2A1B04"/><stop offset="1" stop-color="#080400"/></radialGradient>
    <linearGradient id="gold" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#E8D08A"/><stop offset="1" stop-color="#B8963C"/></linearGradient>
    <mask id="crescent"><rect width="1024" height="1024" fill="black"/><circle cx="512" cy="330" r="215" fill="white"/><circle cx="585" cy="286" r="180" fill="black"/></mask>
  </defs>
  <rect width="1024" height="1024" fill="url(#glow)"/>
  <g transform="translate(512 512) scale(${1 - pad}) translate(-512 -512)">
    <rect width="1024" height="1024" fill="url(#gold)" mask="url(#crescent)"/>
    <text x="512" y="830" text-anchor="middle" font-family="AmiriIcon" font-weight="700" font-size="330" fill="url(#gold)" direction="rtl">تاريخ</text>
  </g>
</svg>`;

const page = (body, w, h) => `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face{font-family:AmiriIcon;src:url("${font}") format("woff2");font-weight:700}
@font-face{font-family:InterIcon;src:url("${inter}") format("woff2");font-weight:100 900}
html,body{margin:0;width:${w}px;height:${h}px;background:#080400;overflow:hidden}</style></head><body>${body}</body></html>`;

const browser = await chromium.launch();
async function shot(html, w, h, file) {
  const p = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  await p.setContent(html);
  await p.evaluate(async () => { await document.fonts.load('700 100px AmiriIcon'); await document.fonts.load('700 40px InterIcon'); await document.fonts.ready; });
  await p.waitForTimeout(150);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  await p.screenshot({ path: file, type: 'png' });
  await p.close();
  // Apple refuse les icônes avec canal alpha : on le retire.
  try { execFileSync('convert', [file, '-alpha', 'off', '-strip', file]); } catch { /* ImageMagick absent : PNG déjà opaque */ }
  console.log('ok', path.relative(root, file));
}
const square = (size, file, pad = 0) => shot(page(`<div style="width:${size}px;height:${size}px">${art(pad)}</div>`, size, size), size, size, file);

const web = path.join(root, 'web/icons');
fs.mkdirSync(web, { recursive: true });
fs.writeFileSync(path.join(web, 'icon.svg'), art(0).replace('font-family="AmiriIcon"', 'font-family="Amiri, serif"').trim() + '\n');
await square(192, path.join(web, 'icon-192.png'));
await square(512, path.join(web, 'icon-512.png'));
await square(512, path.join(web, 'icon-maskable-512.png'), 0.2);
await square(180, path.join(web, 'apple-touch-icon.png'));
await square(1024, path.join(root, 'appstore/icon/AppIcon-1024.png'));
await shot(page(`<div style="display:flex;align-items:center;gap:60px;height:630px;padding:0 90px;box-sizing:border-box">
  <div style="width:420px;height:420px;border-radius:92px;overflow:hidden;flex:none">${art(0)}</div>
  <div style="font-family:InterIcon,sans-serif;color:#F3EBD8"><div style="font-size:84px;font-weight:700;color:#C9A84C">Tarikh</div>
  <div style="font-size:38px;margin-top:14px;line-height:1.3">L'histoire islamique,<br>chaque jour.</div>
  <div style="font-size:24px;margin-top:26px;color:#9B7E3A;letter-spacing:.14em">FR · EN · AR · ES · ID · UR</div></div></div>`, 1200, 630), 1200, 630, path.join(web, 'og-image.png'));

// iOS : icône et splash (2732 × 2732, logo centré) copiés dans le projet Xcode s'il existe.
const splash = path.join(root, 'appstore/icon/Splash-2732.png');
await shot(page(`<div style="width:2732px;height:2732px;display:grid;place-items:center"><div style="width:900px;height:900px">${art(0)}</div></div>`, 2732, 2732), 2732, 2732, splash);
const assets = path.join(root, 'ios/App/App/Assets.xcassets');
if (fs.existsSync(assets)) {
  fs.copyFileSync(path.join(root, 'appstore/icon/AppIcon-1024.png'), path.join(assets, 'AppIcon.appiconset/AppIcon-512@2x.png'));
  for (const n of ['splash-2732x2732.png', 'splash-2732x2732-1.png', 'splash-2732x2732-2.png']) {
    const dest = path.join(assets, 'Splash.imageset', n);
    if (fs.existsSync(dest)) fs.copyFileSync(splash, dest);
  }
  console.log('ok ios assets');
}
await browser.close();
