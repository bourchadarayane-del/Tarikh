// Abonnement Premium.
// iOS : achat intégré Apple (StoreKit) via RevenueCat. Web : Stripe Checkout créé côté serveur.
// La vérité est côté serveur (table `subscriptions`) : le contenu Premium n'est servi qu'après vérification.
import { api } from './api.js';
import { isNative, openExternal } from './native.js';
import { config, ENTITLEMENT } from './config.js';
import { store, deviceId } from './store.js';
import { lang } from './i18n.js';
import { currentUser } from './auth.js';

let state = { active: false, source: null, until: null, trial: false, checked: false };
const listeners = new Set();
let rc = null; // plugin RevenueCat (natif uniquement)

export const premium = () => state;
export const isPremium = () => state.active;
export const onPremiumChange = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
function setState(next) {
  const changed = next.active !== state.active;
  state = { ...state, ...next, checked: true };
  if (changed) listeners.forEach((fn) => { try { fn(state); } catch (err) { console.error(err); } });
}

export async function initPurchases() {
  if (!isNative() || !config.revenueCatIosKey) return;
  try {
    const mod = await import('@revenuecat/purchases-capacitor');
    await mod.Purchases.configure({ apiKey: config.revenueCatIosKey, appUserID: deviceId() });
    rc = mod.Purchases;
  } catch (err) { console.warn('RevenueCat indisponible', err); }
}

async function nativeEntitlement(info) {
  if (!rc) return null;
  try {
    const customerInfo = info || (await rc.getCustomerInfo()).customerInfo;
    const e = customerInfo?.entitlements?.active?.[ENTITLEMENT];
    return e ? { active: true, source: 'apple', until: e.expirationDate || null, trial: e.periodType === 'TRIAL' || e.periodType === 'trial' } : { active: false };
  } catch { return null; }
}

// Interroge le serveur (et StoreKit en natif). `force` demande au serveur de resynchroniser avec RevenueCat/Stripe.
export async function refreshPremium({ force = false, info = null } = {}) {
  let server = null;
  try { server = await api(`subscription-status${force ? '?refresh=1' : ''}`); } catch { /* hors-ligne ou serveur non configuré */ }
  const native = await nativeEntitlement(info);
  if (server || native) {
    const active = !!(server?.premium || native?.active);
    const next = {
      active,
      source: server?.premium ? server.source : native?.active ? 'apple' : null,
      until: (server?.premium ? server.current_period_end : native?.until) || null,
      trial: !!(server?.premium ? server.status === 'trialing' : native?.trial),
      cancelAtPeriodEnd: !!server?.cancel_at_period_end,
    };
    store.set('premiumCache', { active, until: next.until, at: Date.now() });
    setState(next);
  } else {
    // Aucun moyen de vérifier (hors-ligne) : on garde le dernier état connu pour relire le contenu déjà téléchargé.
    const c = store.get('premiumCache');
    const stillValid = !!(c && c.active && (!c.until || new Date(c.until) > new Date()) && Date.now() - c.at < 14 * 86400000);
    setState({ active: stillValid, source: null, until: c?.until || null, trial: false });
  }
  return state;
}

// Offre affichée sur l'écran d'abonnement (prix réel de l'App Store en natif).
export async function getOffer() {
  if (isNative()) {
    if (!rc) return { available: false };
    try {
      const offerings = await rc.getOfferings();
      const pkg = offerings?.current?.monthly || offerings?.current?.availablePackages?.[0];
      if (!pkg) return { available: false };
      const intro = pkg.product?.introPrice;
      return { available: true, native: true, pkg, price: pkg.product.priceString, trialDays: intro && Number(intro.price) === 0 ? trialDays(intro) : 0 };
    } catch { return { available: false }; }
  }
  return { available: true, native: false, price: null, trialDays: 7 };
}
function trialDays(intro) {
  const n = Number(intro.periodNumberOfUnits) || 1;
  const unit = String(intro.periodUnit || '').toUpperCase();
  return unit === 'WEEK' ? n * 7 : unit === 'MONTH' ? n * 30 : unit === 'YEAR' ? n * 365 : n;
}

// Renvoie 'purchased' | 'cancelled' | 'login_required' | 'redirect'
export async function purchase(offer) {
  if (isNative()) {
    if (!rc || !offer?.pkg) throw new Error('store_unavailable');
    try {
      const res = await rc.purchasePackage({ aPackage: offer.pkg });
      await refreshPremium({ force: true, info: res.customerInfo });
      return 'purchased';
    } catch (err) {
      if (err?.userCancelled || err?.code === '1' || /cancel/i.test(String(err?.message))) return 'cancelled';
      throw err;
    }
  }
  if (!currentUser()) return 'login_required';
  const { url } = await api('create-checkout-session', { method: 'POST', body: { lang: lang() } });
  location.href = url;
  return 'redirect';
}

export async function restore() {
  if (isNative() && rc) {
    const res = await rc.restorePurchases();
    await refreshPremium({ force: true, info: res.customerInfo });
  } else {
    await refreshPremium({ force: true });
  }
  return state.active;
}

export async function manageSubscription() {
  if (isNative() || state.source === 'apple') { openExternal('https://apps.apple.com/account/subscriptions'); return; }
  const { url } = await api('create-portal-session', { method: 'POST', body: {} });
  location.href = url;
}

// Contenu Premium : toujours demandé au serveur (qui vérifie l'abonnement), puis gardé pour la lecture hors-ligne.
export async function getPremiumContent(kind) {
  const key = `pc:${kind}:${lang()}`;
  const cached = store.get(key);
  const fresh = cached && Date.now() - cached.at < 7 * 86400000;
  if (cached && fresh && state.active) return cached.data;
  try {
    const res = await api(`premium-content?kind=${encodeURIComponent(kind)}&lang=${lang()}`);
    store.set(key, { at: Date.now(), data: res.data });
    return res.data;
  } catch (err) {
    if (err.status === 402 || err.status === 401) { setState({ active: false }); for (const k of store.keys('pc:')) store.del(k); throw err; }
    if (cached && state.active) return cached.data;
    throw err;
  }
}
export function clearPremiumCache() { for (const k of store.keys('pc:')) store.del(k); store.del('premiumCache'); }
