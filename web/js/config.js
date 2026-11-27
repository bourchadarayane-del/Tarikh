// Configuration publique injectée au build (www/config.js). Aucune clé secrète ici.
const c = (typeof window !== 'undefined' && window.TARIKH_CONFIG) || {};
export const config = {
  supabaseUrl: c.supabaseUrl || '',
  supabaseAnonKey: c.supabaseAnonKey || '',
  oneSignalAppId: c.oneSignalAppId || '',
  revenueCatIosKey: c.revenueCatIosKey || '',
  siteUrl: c.siteUrl || '',
  version: c.version || '1.0.0',
};
export const PRODUCT_ID = 'tarikh_premium_monthly';
export const ENTITLEMENT = 'premium';
export const QURAN_URL = 'https://quran.com';
export const KAABA_LIVE_URL = 'https://www.youtube.com/results?search_query=Makkah+live';
export const SUPPORT_EMAIL = 'bourchada.rayane@gmail.com';
