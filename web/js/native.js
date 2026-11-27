// Pont vers les fonctions natives iOS (Capacitor). Chaque fonction a un repli web.
import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { Geolocation } from '@capacitor/geolocation';
import { Share } from '@capacitor/share';
import { Browser } from '@capacitor/browser';
import { config } from './config.js';

export const isNative = () => Capacitor.isNativePlatform();
export const platform = () => Capacitor.getPlatform();
// En natif, l'API vit sur le site web ; sur le web, même origine.
export const apiBase = () => (isNative() ? config.siteUrl : '');

export async function hapticTap(strong = false) {
  try { await Haptics.impact({ style: strong ? ImpactStyle.Medium : ImpactStyle.Light }); } catch { /* non disponible */ }
}
export async function hapticSuccess() {
  try { await Haptics.notification({ type: NotificationType.Success }); } catch { /* non disponible */ }
}

export async function getPosition() {
  if (isNative()) {
    const perm = await Geolocation.requestPermissions();
    if (perm.location !== 'granted' && perm.coarseLocation !== 'granted') throw new Error('denied');
  }
  const pos = await Geolocation.getCurrentPosition({ enableHighAccuracy: false, timeout: 15000, maximumAge: 600000 });
  return { lat: pos.coords.latitude, lon: pos.coords.longitude };
}

export async function openUrl(url) {
  if (isNative()) { try { await Browser.open({ url }); return; } catch { /* repli */ } }
  window.open(url, '_blank', 'noopener');
}
// Ouvre une appli externe (Plans, réglages d'abonnement) plutôt qu'un navigateur intégré.
export function openExternal(url) {
  if (isNative()) window.open(url, '_system');
  else window.open(url, '_blank', 'noopener');
}

export async function shareText({ title, text, url }) {
  try {
    if (isNative() || navigator.share) { await Share.share({ title, text, url, dialogTitle: title }); return true; }
  } catch (err) { if (err && /cancel/i.test(String(err.message))) return false; }
  try { await navigator.clipboard.writeText([text, url].filter(Boolean).join('\n')); return 'copied'; } catch { return false; }
}

// Partage d'une image (PNG) : fichier temporaire en natif, Web Share API ou téléchargement sur le web.
export async function shareImage(blob, { title, text, filename = 'tarikh.png' }) {
  if (isNative()) {
    const { Filesystem, Directory } = await import('@capacitor/filesystem');
    const data = await new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result).split(',')[1]);
      r.onerror = reject;
      r.readAsDataURL(blob);
    });
    const file = await Filesystem.writeFile({ path: filename, data, directory: Directory.Cache });
    await Share.share({ title, text, files: [file.uri], dialogTitle: title });
    return true;
  }
  const file = new File([blob], filename, { type: 'image/png' });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], title, text }); return true; } catch { return false; }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  return 'downloaded';
}

export async function hideSplash() {
  if (!isNative()) return;
  try { const { SplashScreen } = await import('@capacitor/splash-screen'); await SplashScreen.hide(); } catch { /* ignore */ }
}
export async function onResume(fn) {
  if (isNative()) {
    try { const { App } = await import('@capacitor/app'); App.addListener('resume', fn); return; } catch { /* repli */ }
  }
  document.addEventListener('visibilitychange', () => { if (!document.hidden) fn(); });
}
