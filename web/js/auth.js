// Compte OPTIONNEL : connexion par e-mail (code à 6 chiffres ou lien magique) via l'API Auth de Supabase.
// Client minimal (pas de SDK côté navigateur) : la session est stockée sur l'appareil.
import { config } from './config.js';
import { store } from './store.js';

const base = () => `${config.supabaseUrl}/auth/v1`;
const headers = (token) => ({ 'content-type': 'application/json', apikey: config.supabaseAnonKey, ...(token ? { authorization: `Bearer ${token}` } : {}) });
export const authAvailable = () => !!(config.supabaseUrl && config.supabaseAnonKey);

function save(data) {
  if (!data || !data.access_token) return null;
  const session = {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: data.expires_at || Math.floor(Date.now() / 1000) + (Number(data.expires_in) || 3600),
    user: data.user ? { id: data.user.id, email: data.user.email } : store.get('session')?.user || null,
  };
  store.set('session', session);
  return session;
}
export const currentUser = () => store.get('session')?.user || null;

export async function sendCode(email) {
  const res = await fetch(`${base()}/otp`, {
    method: 'POST', headers: headers(),
    body: JSON.stringify({ email, create_user: true, options: { email_redirect_to: location.origin + '/' } }),
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).msg || 'otp_failed');
  return true;
}

export async function verifyCode(email, token) {
  const res = await fetch(`${base()}/verify`, { method: 'POST', headers: headers(), body: JSON.stringify({ type: 'email', email, token }) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.msg || data.error_description || 'verify_failed');
  return save(data);
}

// Retour d'un lien magique sur le web : #access_token=…&refresh_token=…
export async function consumeHashSession() {
  if (!/access_token=/.test(location.hash)) return null;
  const p = new URLSearchParams(location.hash.replace(/^#\/?/, ''));
  history.replaceState(null, '', location.pathname + '#/today');
  const session = save({ access_token: p.get('access_token'), refresh_token: p.get('refresh_token'), expires_in: p.get('expires_in') });
  if (session && !session.user) {
    const res = await fetch(`${base()}/user`, { headers: headers(session.access_token) });
    if (res.ok) { const u = await res.json(); session.user = { id: u.id, email: u.email }; store.set('session', session); }
  }
  return session;
}

// Jeton d'accès valide (rafraîchi si besoin) ou null si déconnecté.
export async function accessToken() {
  const s = store.get('session');
  if (!s) return null;
  if (s.expires_at - 60 > Date.now() / 1000) return s.access_token;
  try {
    const res = await fetch(`${base()}/token?grant_type=refresh_token`, { method: 'POST', headers: headers(), body: JSON.stringify({ refresh_token: s.refresh_token }) });
    if (!res.ok) { if (res.status === 400 || res.status === 401) store.del('session'); return null; }
    return save(await res.json())?.access_token || null;
  } catch { return s.access_token; } // hors-ligne : on garde l'ancien jeton
}

export async function signOut() {
  const token = store.get('session')?.access_token;
  store.del('session');
  if (token && authAvailable()) { try { await fetch(`${base()}/logout`, { method: 'POST', headers: headers(token) }); } catch { /* ignore */ } }
}
