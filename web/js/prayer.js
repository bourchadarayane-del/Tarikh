// Horaires de prière calculés LOCALEMENT (hors-ligne) avec la bibliothèque adhan.
import { Coordinates, CalculationMethod, PrayerTimes, Madhab, HighLatitudeRule } from 'adhan';

export const PRAYERS = ['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha'];
export const METHODS = ['mwl', 'karachi', 'kemenag', 'uoif', 'ummalqura', 'egypt', 'isna', 'turkey'];

function params(method) {
  switch (method) {
    case 'karachi': return CalculationMethod.Karachi();
    case 'kemenag': return CalculationMethod.Singapore(); // Fajr 20°, Isha 18° : Indonésie, Malaisie, Singapour
    case 'uoif': { const p = CalculationMethod.Other(); p.fajrAngle = 12; p.ishaAngle = 12; return p; }
    case 'ummalqura': return CalculationMethod.UmmAlQura();
    case 'egypt': return CalculationMethod.Egyptian();
    case 'isna': return CalculationMethod.NorthAmerica();
    case 'turkey': return CalculationMethod.Turkey();
    default: return CalculationMethod.MuslimWorldLeague();
  }
}

const BY_COUNTRY = {
  ID: 'kemenag', MY: 'kemenag', SG: 'kemenag', BN: 'kemenag',
  PK: 'karachi', IN: 'karachi', BD: 'karachi', AF: 'karachi', LK: 'karachi',
  FR: 'uoif', BE: 'uoif', CH: 'uoif', LU: 'uoif',
  SA: 'ummalqura', AE: 'ummalqura', QA: 'ummalqura', KW: 'ummalqura', BH: 'ummalqura', OM: 'ummalqura', YE: 'ummalqura',
  EG: 'egypt', SD: 'egypt', LY: 'egypt', SY: 'egypt', LB: 'egypt', JO: 'egypt', IQ: 'egypt', PS: 'egypt',
  US: 'isna', CA: 'isna', TR: 'turkey',
};
const BY_TZ = [
  [/^Asia\/(Jakarta|Makassar|Jayapura|Pontianak|Kuala_Lumpur|Kuching|Singapore|Brunei)/, 'kemenag'],
  [/^Asia\/(Karachi|Kolkata|Calcutta|Dhaka|Kabul|Colombo)/, 'karachi'],
  [/^Europe\/(Paris|Brussels|Zurich|Luxembourg)/, 'uoif'],
  [/^Asia\/(Riyadh|Dubai|Qatar|Kuwait|Bahrain|Muscat|Aden)/, 'ummalqura'],
  [/^Africa\/(Cairo|Khartoum|Tripoli)|^Asia\/(Damascus|Beirut|Amman|Baghdad|Gaza|Hebron)/, 'egypt'],
  [/^America\//, 'isna'],
  [/^Europe\/Istanbul/, 'turkey'],
];
const HANAFI_COUNTRIES = ['PK', 'IN', 'BD', 'AF', 'TR'];

export function defaultMethod(country, timeZone) {
  if (country && BY_COUNTRY[country]) return BY_COUNTRY[country];
  const tz = timeZone || (() => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone; } catch { return ''; } })();
  for (const [re, m] of BY_TZ) if (re.test(tz || '')) return m;
  return 'mwl';
}
export const defaultAsr = (country, timeZone = '') =>
  HANAFI_COUNTRIES.includes(country) || /^Asia\/(Karachi|Kolkata|Calcutta|Dhaka|Kabul)|^Europe\/Istanbul/.test(timeZone) ? 'hanafi' : 'standard';

// Renvoie { fajr, sunrise, dhuhr, asr, maghrib, isha } en objets Date.
export function prayerTimes(lat, lon, date = new Date(), method = 'mwl', asr = 'standard') {
  const coords = new Coordinates(lat, lon);
  const p = params(method);
  p.madhab = asr === 'hanafi' ? Madhab.Hanafi : Madhab.Shafi;
  p.highLatitudeRule = HighLatitudeRule.recommended(coords);
  const t = new PrayerTimes(coords, date, p);
  const out = {};
  for (const name of PRAYERS) out[name] = t[name];
  return out;
}

// Prochaine prière (hors lever du soleil) ; après Isha : Fajr du lendemain.
export function nextPrayer(lat, lon, now = new Date(), method = 'mwl', asr = 'standard') {
  const today = prayerTimes(lat, lon, now, method, asr);
  for (const name of PRAYERS) {
    if (name !== 'sunrise' && today[name] instanceof Date && !isNaN(today[name]) && today[name] > now) return { name, time: today[name], times: today };
  }
  const tomorrow = new Date(now); tomorrow.setDate(tomorrow.getDate() + 1);
  const next = prayerTimes(lat, lon, tomorrow, method, asr);
  return { name: 'fajr', time: next.fajr, times: today };
}

export function formatCountdown(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(h)}:${pad(m)}:${pad(sec)}`;
}
