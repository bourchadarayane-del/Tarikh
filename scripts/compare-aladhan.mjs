// Compare les horaires calculés localement (bibliothèque adhan) à ceux de l'API Aladhan, pour 2 villes.
// À lancer sur une machine avec accès Internet : node scripts/compare-aladhan.mjs
// (Non exécuté dans l'environnement de développement d'origine : api.aladhan.com y était bloqué par le réseau.)
import { prayerTimes } from '../web/js/prayer.js';

const CASES = [
  { city: 'Paris', lat: 48.8566, lon: 2.3522, method: 'mwl', aladhan: 3, tz: 'Europe/Paris' },
  { city: 'Jakarta', lat: -6.2088, lon: 106.8456, method: 'kemenag', aladhan: 11, tz: 'Asia/Jakarta' },
];
const NAMES = { fajr: 'Fajr', sunrise: 'Sunrise', dhuhr: 'Dhuhr', asr: 'Asr', maghrib: 'Maghrib', isha: 'Isha' };
const now = new Date();
const ddmmyyyy = `${String(now.getDate()).padStart(2, '0')}-${String(now.getMonth() + 1).padStart(2, '0')}-${now.getFullYear()}`;
let worst = 0;
for (const c of CASES) {
  const res = await fetch(`https://api.aladhan.com/v1/timings/${ddmmyyyy}?latitude=${c.lat}&longitude=${c.lon}&method=${c.aladhan}`);
  if (!res.ok) { console.error(`${c.city} : Aladhan injoignable (${res.status})`); process.exit(2); }
  const remote = (await res.json()).data.timings;
  const local = prayerTimes(c.lat, c.lon, now, c.method);
  const fmt = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: c.tz });
  console.log(`\n${c.city} (${c.method})`);
  for (const [k, name] of Object.entries(NAMES)) {
    const mine = fmt.format(local[k]), theirs = remote[name].slice(0, 5);
    const diff = Math.abs((+mine.slice(0, 2) * 60 + +mine.slice(3)) - (+theirs.slice(0, 2) * 60 + +theirs.slice(3)));
    worst = Math.max(worst, diff);
    console.log(`  ${name.padEnd(8)} local ${mine}   aladhan ${theirs}   écart ${diff} min`);
  }
}
console.log(`\nÉcart maximal : ${worst} min (${worst <= 3 ? 'OK' : 'à vérifier'})`);
process.exit(worst <= 3 ? 0 : 1);
