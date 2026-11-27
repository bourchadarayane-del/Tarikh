// Image à partager (1080 × 1350) dessinée sur un canvas : aucune donnée envoyée à un serveur.
import { dir, t } from './i18n.js';

function wrap(ctx, text, maxWidth) {
  const lines = [];
  for (const para of String(text).split(/\n+/)) {
    let line = '';
    for (const word of para.split(/\s+/)) {
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width > maxWidth && line) { lines.push(line); line = word; } else line = test;
    }
    if (line) lines.push(line);
  }
  return lines;
}

export async function storyImage({ label, title, body, footer }) {
  const W = 1080, H = 1350, M = 96;
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  const rtl = dir() === 'rtl';
  try { await Promise.all([document.fonts.load('700 96px Amiri'), document.fonts.load('700 60px "Playfair Display"'), document.fonts.load('400 38px Inter')]); } catch { /* polices système */ }

  ctx.fillStyle = '#080400'; ctx.fillRect(0, 0, W, H);
  const g = ctx.createRadialGradient(W / 2, 0, 0, W / 2, 0, H);
  g.addColorStop(0, 'rgba(201,168,76,0.16)'); g.addColorStop(1, 'rgba(201,168,76,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = '#9B7E3A'; ctx.lineWidth = 3; ctx.strokeRect(40, 40, W - 80, H - 80);
  ctx.strokeStyle = '#C9A84C'; ctx.lineWidth = 1; ctx.strokeRect(54, 54, W - 108, H - 108);

  ctx.textAlign = 'center'; ctx.fillStyle = '#C9A84C';
  ctx.font = '700 104px Amiri, serif'; ctx.direction = 'rtl'; ctx.fillText('تاريخ', W / 2, 190);
  ctx.direction = rtl ? 'rtl' : 'ltr';
  const serif = rtl ? 'Amiri, serif' : '"Playfair Display", Amiri, serif';
  const sans = rtl ? 'Amiri, serif' : 'Inter, Amiri, sans-serif';
  ctx.font = `600 30px ${sans}`; ctx.fillStyle = '#9B7E3A';
  ctx.fillText(String(label || '').toUpperCase(), W / 2, 262);

  let y = 360;
  ctx.fillStyle = '#E8D9A8'; ctx.font = `700 62px ${serif}`;
  for (const line of wrap(ctx, title, W - 2 * M).slice(0, 3)) { ctx.fillText(line, W / 2, y); y += 78; }
  y += 26;
  ctx.fillStyle = '#C9A84C'; ctx.fillRect(W / 2 - 60, y - 40, 120, 3);
  y += 30;
  ctx.fillStyle = '#F3EBD8'; ctx.font = `400 40px ${sans}`;
  ctx.textAlign = rtl ? 'right' : 'left';
  const x = rtl ? W - M : M;
  const lines = wrap(ctx, body, W - 2 * M);
  const max = Math.floor((H - 190 - y) / 58);
  lines.slice(0, max).forEach((line, i) => {
    const last = i === max - 1 && lines.length > max;
    ctx.fillText(last ? line.replace(/.{0,3}$/, '…') : line, x, y); y += 58;
  });
  ctx.textAlign = 'center'; ctx.fillStyle = '#9B7E3A'; ctx.font = `500 30px ${sans}`;
  ctx.fillText(footer || t('share.footer'), W / 2, H - 96);
  return await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
}
