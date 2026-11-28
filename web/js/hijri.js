// Calendrier hégirien : Intl (Umm al-Qura) avec repli sur l'algorithme tabulaire, ajustement de ±2 jours.
import { addDays } from './store.js';

let fmt = null;
try {
  const f = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura-nu-latn', { day: 'numeric', month: 'numeric', year: 'numeric' });
  if (f.resolvedOptions().calendar === 'islamic-umalqura') fmt = f;
} catch { /* repli ci-dessous */ }

// Algorithme tabulaire (civil) : utilisé seulement si Intl ne connaît pas le calendrier.
export function tabularHijri(date) {
  const jd = Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000) + 2440588;
  let l = jd - 1948440 + 10632;
  const n = Math.floor((l - 1) / 10631);
  l = l - 10631 * n + 354;
  const j = Math.floor((10985 - l) / 5316) * Math.floor((50 * l) / 17719) + Math.floor(l / 5670) * Math.floor((43 * l) / 15238);
  l = l - Math.floor((30 - j) / 15) * Math.floor((17719 * j) / 50) - Math.floor(j / 16) * Math.floor((15238 * j) / 43) + 29;
  const m = Math.floor((24 * l) / 709);
  return { y: 30 * n + j - 30, m, d: l - Math.floor((709 * m) / 24) };
}

// adjust : nombre de jours à ajouter (observation locale de la lune).
export function toHijri(date = new Date(), adjust = 0) {
  const d = adjust ? addDays(date, adjust) : date;
  if (!fmt) return tabularHijri(d);
  const parts = Object.fromEntries(fmt.formatToParts(d).map((p) => [p.type, p.value]));
  return { y: parseInt(parts.year, 10), m: parseInt(parts.month, 10), d: parseInt(parts.day, 10) };
}

// Tous les jours grégoriens du mois hégirien contenant `date`.
export function hijriMonthDays(date = new Date(), adjust = 0) {
  const ref = toHijri(date, adjust);
  let start = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12);
  for (let i = 0; i < 31 && toHijri(start, adjust).d !== 1; i++) start = addDays(start, -1);
  const days = [];
  for (let i = 0; i < 31; i++) {
    const g = addDays(start, i);
    const h = toHijri(g, adjust);
    if (h.m !== ref.m || h.y !== ref.y) break;
    days.push({ date: g, h });
  }
  return { y: ref.y, m: ref.m, days };
}

// Prochaine date grégorienne correspondant à un jour hégirien (ex. 1 Ramadan = 9, 1).
export function nextHijriDate(month, day, from = new Date(), adjust = 0) {
  let g = new Date(from.getFullYear(), from.getMonth(), from.getDate(), 12);
  for (let i = 0; i < 400; i++) {
    const h = toHijri(g, adjust);
    if (h.m === month && h.d === day) return g;
    g = addDays(g, 1);
  }
  return null;
}

// Jours de jeûne surérogatoire : lundi, jeudi, jours blancs (13-15), sauf jours où le jeûne est interdit.
export function fastingInfo(date = new Date(), adjust = 0) {
  const h = toHijri(date, adjust);
  const dow = date.getDay();
  const forbidden = (h.m === 10 && h.d === 1) || (h.m === 12 && h.d >= 10 && h.d <= 13);
  const ramadan = h.m === 9;
  const reasons = [];
  if (!forbidden && !ramadan) {
    if (dow === 1) reasons.push('monday');
    if (dow === 4) reasons.push('thursday');
    if (h.d >= 13 && h.d <= 15) reasons.push('white');
    if (h.m === 1 && (h.d === 9 || h.d === 10)) reasons.push('ashura');
    if (h.m === 12 && h.d === 9) reasons.push('arafat');
    if (h.m === 12 && h.d >= 1 && h.d <= 8) reasons.push('dhulhijja');
    if (h.m === 10 && h.d >= 2) reasons.push('shawwal');
  }
  return { h, forbidden, ramadan, reasons, recommended: reasons.length > 0 };
}
