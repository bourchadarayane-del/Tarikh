// Notifications. Natif iOS : rappels LOCAUX de prière (calculés hors-ligne, 7 jours glissants)
// + push OneSignal (APNs) pour l'histoire du jour. Sur le web : non disponibles (limite d'iOS/WebView).
import { isNative } from './native.js';
import { store, addDays, dateKey } from './store.js';
import { t, lang, fmtTime } from './i18n.js';
import { prayerTimes } from './prayer.js';
import { fastingInfo } from './hijri.js';
import { config } from './config.js';

export const NOTIF_PRAYERS = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];
export const notifSettings = () => ({
  enabled: false, daily: true, dailyTime: '08:00', fasting: true,
  prayers: { fajr: true, dhuhr: true, asr: true, maghrib: true, isha: true },
  ...store.get('notif', {}),
});
export const notificationsSupported = () => isNative();
export const pushConfigured = () => !!(config.oneSignalAppId && oneSignalPlugin());

async function plugin() { return (await import('@capacitor/local-notifications')).LocalNotifications; }
const oneSignalPlugin = () => (typeof window !== 'undefined' && window.plugins && window.plugins.OneSignal) || null;

export function initPush() {
  const os = oneSignalPlugin();
  if (!os || !config.oneSignalAppId) return;
  try { os.initialize(config.oneSignalAppId); os.User.setLanguage(lang()); } catch (err) { console.warn('OneSignal', err); }
}
export function setPushLanguage() { try { oneSignalPlugin()?.User.setLanguage(lang()); } catch { /* ignore */ } }

// Demande l'autorisation (une seule fenêtre iOS pour les rappels locaux et les push).
export async function requestNotificationPermission() {
  if (!isNative()) return false;
  const ln = await plugin();
  let status = (await ln.checkPermissions()).display;
  if (status !== 'granted') status = (await ln.requestPermissions()).display;
  if (status === 'granted') { try { await oneSignalPlugin()?.Notifications.requestPermission(false); } catch { /* ignore */ } }
  return status === 'granted';
}

// Construit la liste des rappels (fonction pure, testable) : au plus 49 notifications (limite iOS : 64).
export function buildSchedule(settings, loc, opts, now = new Date()) {
  const list = [];
  if (!settings.enabled) return list;
  for (let day = 0; day < 7; day++) {
    const date = addDays(now, day);
    if (loc && Number.isFinite(loc.lat)) {
      const times = prayerTimes(loc.lat, loc.lon, date, opts.method, opts.asr);
      NOTIF_PRAYERS.forEach((name, i) => {
        const at = times[name];
        if (settings.prayers[name] && at instanceof Date && !isNaN(at) && at > now) {
          list.push({ id: 1000 + day * 10 + i, title: t('prayer.' + name), body: t('notif.prayerBody', { prayer: t('prayer.' + name), time: fmtTime(at) }), at });
        }
      });
    }
    if (settings.daily) {
      const [hh, mm] = String(settings.dailyTime || '08:00').split(':').map(Number);
      const at = new Date(date.getFullYear(), date.getMonth(), date.getDate(), hh || 8, mm || 0);
      if (at > now) list.push({ id: 2000 + day, title: t('notif.dailyTitle'), body: t('notif.dailyBody'), at });
    }
    if (settings.fasting) {
      const info = fastingInfo(addDays(date, 1), opts.hijriAdjust || 0);
      const at = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 20, 30);
      if (info.recommended && at > now) list.push({ id: 3000 + day, title: t('notif.fastTitle'), body: t('notif.fastBody'), at });
    }
  }
  return list;
}

export async function rescheduleNotifications() {
  if (!isNative()) return 0;
  try {
    const ln = await plugin();
    const pending = await ln.getPending();
    if (pending.notifications.length) await ln.cancel({ notifications: pending.notifications.map((n) => ({ id: n.id })) });
    const settings = notifSettings();
    if (!settings.enabled || (await ln.checkPermissions()).display !== 'granted') return 0;
    const s = store.get('settings', {});
    // Si le push OneSignal est configuré, c'est lui qui annonce l'histoire du jour : pas de doublon avec le rappel local.
    const effective = { ...settings, daily: settings.daily && !pushConfigured() };
    const list = buildSchedule(effective, store.get('location'), { method: s.method || 'mwl', asr: s.asr || 'standard', hijriAdjust: s.hijriAdjust || 0 });
    if (list.length) {
      await ln.schedule({ notifications: list.map((n) => ({ id: n.id, title: n.title, body: n.body, schedule: { at: n.at, allowWhileIdle: true } })) });
    }
    store.set('notif:last', dateKey());
    return list.length;
  } catch (err) { console.warn('notifications', err); return 0; }
}
