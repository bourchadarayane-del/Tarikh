// Identité de l'appelant et contrôles d'accès.
import { timingSafeEqual } from 'node:crypto';
import { isActiveRow } from './supabase.js';

const APP_USER_RE = /^[A-Za-z0-9_$:.\-]{8,128}$/;

export function bearer(request) {
  const m = /^Bearer\s+(.+)$/i.exec(request.headers.get('authorization') || '');
  return m ? m[1].trim() : null;
}

export function safeEqual(a, b) {
  const x = Buffer.from(String(a ?? '')), y = Buffer.from(String(b ?? ''));
  return x.length === y.length && x.length > 0 && timingSafeEqual(x, y);
}

// { userId, email, appUserId } : compte (jeton Supabase vérifié) et/ou appareil anonyme.
export async function identify(request, db) {
  const token = bearer(request);
  const user = token ? await db.userFromToken(token) : null;
  const raw = request.headers.get('x-app-user-id') || '';
  return { userId: user?.id || null, email: user?.email || null, appUserId: APP_USER_RE.test(raw) ? raw : null };
}

export async function requireUser(request, db) {
  const who = await identify(request, db);
  if (!who.userId) throw Object.assign(new Error('login_required'), { status: 401 });
  return who;
}

// Meilleure ligne d'abonnement active pour cette identité, ou null.
export async function activeSubscription(who, db) {
  if (!who.userId && !who.appUserId) return null;
  const rows = await db.subscriptionsFor(who);
  return rows.filter((r) => isActiveRow(r)).sort((a, b) => new Date(b.current_period_end || '2999-01-01') - new Date(a.current_period_end || '2999-01-01'))[0] || null;
}

// Endpoints internes (cron, génération) : en-tête « Authorization: Bearer <CRON_SECRET> ».
export function requireCron(request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 16) throw Object.assign(new Error('cron_not_configured'), { status: 503 });
  if (!safeEqual(bearer(request), secret)) throw Object.assign(new Error('unauthorized'), { status: 401 });
}
