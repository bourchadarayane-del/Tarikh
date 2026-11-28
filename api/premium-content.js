// Contenu Premium : servi uniquement après vérification de l'abonnement côté serveur.
// GET /api/premium-content?kind=prophets|hajj|quiz|days|history&lang=fr
import { handler, json, fail, preflight } from './_lib/http.js';
import { identify, activeSubscription } from './_lib/auth.js';
import { db as realDb } from './_lib/supabase.js';
import { syncRevenueCat } from './subscription-status.js';
import { premiumFromFiles } from './_lib/premium-files.js';

const KINDS = ['prophets', 'hajj', 'quiz', 'days', 'history'];
const LANGS = ['fr', 'en', 'ar', 'es', 'id', 'ur'];

export function createPremiumContent({ db = realDb, fetchImpl = fetch } = {}) {
  return handler(async (request) => {
    const url = new URL(request.url);
    const kind = url.searchParams.get('kind'), lang = url.searchParams.get('lang') || 'fr';
    if (!KINDS.includes(kind) || !LANGS.includes(lang)) return fail(request, 400, 'invalid_request');
    const who = await identify(request, db);
    if (!who.userId && !who.appUserId) return fail(request, 401, 'identity_required');
    let row = await activeSubscription(who, db);
    if (!row && who.appUserId) { try { await syncRevenueCat(who.appUserId, db, fetchImpl); row = await activeSubscription(who, db); } catch { /* reste non abonné */ } }
    if (!row) return fail(request, 402, 'premium_required');
    let data = kind === 'prophets' ? await db.prophets(lang) : kind === 'history' ? await db.history(lang) : await db.premiumContent(kind, lang);
    // Base non remplie (seed.sql pas encore exécuté) : on sert la version embarquée avec le serveur.
    if (kind !== 'history' && (data == null || (Array.isArray(data) && !data.length))) data = premiumFromFiles(kind, lang);
    if (data == null || (Array.isArray(data) && !data.length && kind !== 'history')) return fail(request, 404, 'content_missing');
    return json(request, { kind, lang, data });
  });
}
export const GET = createPremiumContent();
export const OPTIONS = preflight;
