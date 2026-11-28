// Appels au serveur Tarikh (fonctions Vercel) avec l'identité de l'appareil et, si connecté, le jeton utilisateur.
import { apiBase } from './native.js';
import { accessToken } from './auth.js';
import { deviceId } from './store.js';

export async function api(path, { method = 'GET', body, timeout = 20000 } = {}) {
  const token = await accessToken();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeout);
  try {
    const res = await fetch(`${apiBase()}/api/${path}`, {
      method,
      signal: ctrl.signal,
      headers: {
        'x-app-user-id': deviceId(),
        ...(body ? { 'content-type': 'application/json' } : {}),
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) { const err = new Error(data.error || `http_${res.status}`); err.status = res.status; throw err; }
    return data;
  } finally { clearTimeout(timer); }
}
