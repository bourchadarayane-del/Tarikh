// Calculs : Qibla, calendrier hégirien, horaires de prière, rappels locaux.
import test from 'node:test';
import assert from 'node:assert/strict';
import { qiblaBearing, qiblaDistanceKm } from '../web/js/qibla.js';
import { toHijri, tabularHijri, hijriMonthDays, nextHijriDate, fastingInfo } from '../web/js/hijri.js';
import { prayerTimes, nextPrayer, defaultMethod, defaultAsr, formatCountdown, PRAYERS, METHODS } from '../web/js/prayer.js';
import { dateKey, addDays, dayNumber } from '../web/js/store.js';

const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} vs ${b}`);

test('Qibla : angles connus (Paris ≈ 119°, Jakarta ≈ 295°, New York ≈ 58°)', () => {
  near(qiblaBearing(48.8566, 2.3522), 119, 1, 'Paris');
  near(qiblaBearing(-6.2088, 106.8456), 295, 1, 'Jakarta');
  near(qiblaBearing(40.7128, -74.006), 58.5, 1, 'New York');
  near(qiblaBearing(33.6844, 73.0479), 255.5, 1.5, 'Islamabad');
  for (const [lat, lon] of [[0, 0], [-33.9, 151.2], [64.1, -21.9], [21.5, 39.2]]) { const b = qiblaBearing(lat, lon); assert.ok(b >= 0 && b < 360); }
  near(qiblaDistanceKm(48.8566, 2.3522), 4497, 30, 'distance Paris');
  near(qiblaDistanceKm(21.4225, 39.8262), 0, 0.01, 'distance Kaaba');
});

test('Hijri : dates de référence et ajustement', () => {
  assert.deepEqual(toHijri(new Date(2025, 2, 1)), { y: 1446, m: 9, d: 1 }); // 1er Ramadan 1446 (Umm al-Qura)
  assert.deepEqual(toHijri(new Date(2024, 6, 7)), { y: 1446, m: 1, d: 1 }); // 1er Muharram 1446
  assert.deepEqual(toHijri(new Date(2025, 2, 1), 1), { y: 1446, m: 9, d: 2 });
  assert.deepEqual(toHijri(new Date(2025, 2, 1), -1).m, 8);
  const tab = tabularHijri(new Date(2025, 2, 1));
  assert.equal(tab.y, 1446); assert.ok(Math.abs(tab.d - 1) <= 2 || tab.d >= 29);
  const month = hijriMonthDays(new Date(2025, 2, 15));
  assert.ok([29, 30].includes(month.days.length)); assert.equal(month.days[0].h.d, 1); assert.equal(month.m, 9);
  assert.equal(dateKey(nextHijriDate(9, 1, new Date(2025, 0, 1))), '2025-03-01');
});

test('Jeûne : lundi/jeudi, jours blancs, jours interdits', () => {
  const eid = nextHijriDate(10, 1, new Date(2025, 0, 1));
  assert.equal(fastingInfo(eid).forbidden, true); assert.equal(fastingInfo(eid).recommended, false);
  const arafat = nextHijriDate(12, 9, new Date(2025, 0, 1));
  assert.ok(fastingInfo(arafat).reasons.includes('arafat'));
  assert.equal(fastingInfo(addDays(arafat, 1)).forbidden, true);
  const ramadan = fastingInfo(new Date(2025, 2, 10)); assert.equal(ramadan.ramadan, true); assert.equal(ramadan.recommended, false);
  const white = nextHijriDate(5, 13, new Date(2025, 0, 1)); assert.ok(fastingInfo(white).reasons.includes('white'));
});

test('Horaires de prière : ordre, plausibilité, méthodes', () => {
  const date = new Date(Date.UTC(2026, 5, 15, 9));
  for (const [name, lat, lon, off] of [['Paris', 48.8566, 2.3522, 2], ['Jakarta', -6.2088, 106.8456, 7], ['Karachi', 24.86, 67.01, 5], ['Makkah', 21.4225, 39.8262, 3], ['New York', 40.7128, -74.006, -4]]) {
    for (const m of METHODS) {
      const t = prayerTimes(lat, lon, date, m);
      for (let i = 1; i < PRAYERS.length; i++) assert.ok(t[PRAYERS[i]] > t[PRAYERS[i - 1]], `${name} ${m} ordre ${PRAYERS[i]}`);
      const localNoon = (t.dhuhr.getUTCHours() + t.dhuhr.getUTCMinutes() / 60 + off + 24) % 24;
      assert.ok(localNoon > 11.4 && localNoon < 14.1, `${name} ${m} dhuhr ${localNoon}`);
    }
  }
  // La Mecque, 15 juin : Dhuhr ≈ 12:21, Maghrib ≈ 19:05 (heure locale, UTC+3) — valeurs publiées par Umm al-Qura.
  const mk = prayerTimes(21.4225, 39.8262, date, 'ummalqura');
  near(mk.dhuhr.getUTCHours() * 60 + mk.dhuhr.getUTCMinutes(), 9 * 60 + 21, 3, 'Makkah dhuhr');
  near(mk.maghrib.getUTCHours() * 60 + mk.maghrib.getUTCMinutes(), 16 * 60 + 5, 4, 'Makkah maghrib');
  // Asr hanafite plus tardif que l'Asr standard.
  assert.ok(prayerTimes(24.86, 67.01, date, 'karachi', 'hanafi').asr > prayerTimes(24.86, 67.01, date, 'karachi', 'standard').asr);
  // UOIF (12°) : Fajr plus tardif que MWL (18°) à Paris.
  const winter = new Date(Date.UTC(2026, 11, 15, 9));
  assert.ok(prayerTimes(48.8566, 2.3522, winter, 'uoif').fajr > prayerTimes(48.8566, 2.3522, winter, 'mwl').fajr);
  const n = nextPrayer(48.8566, 2.3522, new Date(Date.UTC(2026, 5, 15, 22, 30)), 'uoif');
  assert.equal(n.name, 'fajr'); assert.ok(n.time > new Date(Date.UTC(2026, 5, 15, 22, 30)));
  assert.equal(defaultMethod('ID'), 'kemenag'); assert.equal(defaultMethod('PK'), 'karachi'); assert.equal(defaultMethod('FR'), 'uoif');
  assert.equal(defaultMethod('', 'Asia/Jakarta'), 'kemenag'); assert.equal(defaultMethod('', 'Etc/Unknown'), 'mwl'); assert.equal(defaultAsr('PK'), 'hanafi');
  assert.equal(formatCountdown(3725000), '01:02:05'); assert.equal(formatCountdown(-5), '00:00:00');
});

test('Rappels locaux : au plus 64 notifications, toutes dans le futur', async () => {
  const { buildSchedule } = await import('../web/js/notifications.js').catch(() => ({}));
  if (!buildSchedule) return; // le module dépend de Capacitor : testé par le bundle e2e
  const now = new Date(2026, 5, 15, 10);
  const list = buildSchedule({ enabled: true, daily: true, dailyTime: '08:00', fasting: true, prayers: { fajr: true, dhuhr: true, asr: true, maghrib: true, isha: true } }, { lat: 48.85, lon: 2.35 }, { method: 'uoif', asr: 'standard' }, now);
  assert.ok(list.length > 30 && list.length <= 64);
  assert.ok(list.every((n) => n.at > now)); assert.equal(new Set(list.map((n) => n.id)).size, list.length);
  assert.equal(buildSchedule({ enabled: false, prayers: {} }, null, {}, now).length, 0);
});

test('Dates locales', () => {
  assert.equal(dateKey(new Date(2026, 0, 5)), '2026-01-05');
  assert.equal(dayNumber(new Date(2026, 0, 2)) - dayNumber(new Date(2026, 0, 1)), 1);
});
