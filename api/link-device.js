// Relie l'appareil (identifiant anonyme) au compte connecté, pour synchroniser l'abonnement entre web et iOS.
import { handler, json, fail, preflight } from './_lib/http.js';
import { requireUser } from './_lib/auth.js';
import { db as realDb } from './_lib/supabase.js';

export function createLinkDevice({ db = realDb } = {}) {
  return handler(async (request) => {
    const who = await requireUser(request, db);
    if (!who.appUserId) return fail(request, 400, 'device_required');
    const owner = await db.linkedUser(who.appUserId);
    if (owner && owner !== who.userId) return fail(request, 409, 'device_linked_to_another_account');
    await db.linkDevice(who.appUserId, who.userId);
    return json(request, { linked: true });
  });
}
export const POST = createLinkDevice();
export const OPTIONS = preflight;
