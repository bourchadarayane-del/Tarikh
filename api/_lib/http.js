// Réponses HTTP et CORS pour les fonctions Vercel (signature Web standard : Request -> Response).
const DEFAULT_SITE = 'https://tarikh-topaz.vercel.app';

export function allowedOrigins() {
  const site = (process.env.PUBLIC_SITE_URL || DEFAULT_SITE).replace(/\/$/, '');
  // capacitor://localhost = l'application iOS ; localhost = développement.
  return [site, DEFAULT_SITE, 'capacitor://localhost', 'ionic://localhost', 'http://localhost', 'http://localhost:3000', 'http://localhost:4173'];
}

export function corsHeaders(request) {
  const origin = request.headers.get('origin') || '';
  const ok = allowedOrigins().includes(origin) || /^https:\/\/tarikh-[a-z0-9-]+\.vercel\.app$/.test(origin);
  return {
    ...(ok ? { 'access-control-allow-origin': origin, vary: 'Origin' } : {}),
    'access-control-allow-methods': 'GET, POST, OPTIONS',
    'access-control-allow-headers': 'authorization, content-type, x-app-user-id',
    'access-control-max-age': '86400',
  };
}

export function json(request, data, status = 200, extra = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...(request ? corsHeaders(request) : {}), ...extra },
  });
}
export const preflight = (request) => new Response(null, { status: 204, headers: corsHeaders(request) });
export const fail = (request, status, error) => json(request, { error }, status);

export async function readJson(request, maxBytes = 64 * 1024) {
  const text = await request.text();
  if (text.length > maxBytes) throw Object.assign(new Error('payload_too_large'), { status: 413 });
  if (!text) return {};
  try { return JSON.parse(text); } catch { throw Object.assign(new Error('invalid_json'), { status: 400 }); }
}

export function siteUrl() { return (process.env.PUBLIC_SITE_URL || DEFAULT_SITE).replace(/\/$/, ''); }

// Enveloppe : gère OPTIONS, les erreurs et ne laisse jamais fuiter un détail interne.
export function handler(fn) {
  return async (request) => {
    try { return await fn(request); }
    catch (err) {
      const status = err.status || 500;
      if (status >= 500) console.error('[api]', err);
      return fail(request, status, status >= 500 ? 'server_error' : err.message);
    }
  };
}
