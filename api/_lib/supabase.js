// Accès à la base avec la clé service_role (SERVEUR UNIQUEMENT : ne jamais l'exposer au navigateur).
// Toutes les requêtes passent par cet objet `db`, ce qui permet de le remplacer par un faux dans les tests.
import { createClient } from '@supabase/supabase-js';

let client = null;
export function admin() {
  if (client) return client;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw Object.assign(new Error('supabase_not_configured'), { status: 503 });
  client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return client;
}

const ok = ({ data, error }) => { if (error) throw Object.assign(new Error(`db: ${error.message}`), { status: 500 }); return data; };
const ACTIVE = ['active', 'trialing', 'grace'];

export const db = {
  // ----- Authentification -----
  async userFromToken(token) {
    const { data, error } = await admin().auth.getUser(token);
    return error || !data?.user ? null : { id: data.user.id, email: data.user.email };
  },
  async deleteUser(userId) { const { error } = await admin().auth.admin.deleteUser(userId); if (error) throw new Error(`db: ${error.message}`); },

  // ----- Webhooks : idempotence -----
  // true si l'événement est nouveau, false s'il a déjà été traité.
  async recordEvent(source, eventId) {
    const { error } = await admin().from('webhook_events').insert({ source, event_id: eventId });
    if (!error) return true;
    if (error.code === '23505') return false;
    throw new Error(`db: ${error.message}`);
  },
  async forgetEvent(source, eventId) { await admin().from('webhook_events').delete().eq('source', source).eq('event_id', eventId); },

  // ----- Abonnements -----
  async upsertSubscription(row) {
    const clean = Object.fromEntries(Object.entries({ ...row, updated_at: new Date().toISOString() }).filter(([, v]) => v !== undefined));
    return ok(await admin().from('subscriptions').upsert(clean, { onConflict: 'source,external_id' }).select().single());
  },
  async getSubscription(source, externalId) {
    return ok(await admin().from('subscriptions').select('*').eq('source', source).eq('external_id', externalId).maybeSingle());
  },
  async moveAppUser(fromIds, toId) {
    if (!fromIds?.length || !toId) return;
    ok(await admin().from('subscriptions').update({ app_user_id: toId, updated_at: new Date().toISOString() }).eq('source', 'apple').in('app_user_id', fromIds));
  },
  async linkedDevices(userId) { return (ok(await admin().from('device_links').select('app_user_id').eq('user_id', userId)) || []).map((r) => r.app_user_id); },
  async linkedUser(appUserId) { return ok(await admin().from('device_links').select('user_id').eq('app_user_id', appUserId).maybeSingle())?.user_id || null; },
  async linkDevice(appUserId, userId) {
    ok(await admin().from('device_links').upsert({ app_user_id: appUserId, user_id: userId }, { onConflict: 'app_user_id' }));
    ok(await admin().from('profiles').upsert({ user_id: userId }, { onConflict: 'user_id' }));
    ok(await admin().from('subscriptions').update({ user_id: userId }).eq('app_user_id', appUserId).is('user_id', null));
  },
  // Toutes les lignes d'abonnement rattachées à cette identité (compte et/ou appareil).
  async subscriptionsFor({ userId, appUserId }) {
    const ids = new Set(appUserId ? [appUserId] : []);
    const users = new Set(userId ? [userId] : []);
    if (userId) for (const d of await this.linkedDevices(userId)) ids.add(d);
    if (appUserId) { const u = await this.linkedUser(appUserId); if (u) users.add(u); }
    const rows = [];
    if (users.size) rows.push(...(ok(await admin().from('subscriptions').select('*').in('user_id', [...users])) || []));
    if (ids.size) rows.push(...(ok(await admin().from('subscriptions').select('*').in('app_user_id', [...ids])) || []));
    return [...new Map(rows.map((r) => [r.id, r])).values()];
  },

  // ----- Contenus -----
  async storiesOn(date) { return ok(await admin().from('daily_stories').select('lang,title,topic_key').eq('date', date)) || []; },
  async usedTopics() { return ok(await admin().from('story_topics').select('topic_key,origin,published_on,title_en').order('created_at', { ascending: false }).limit(1000)) || []; },
  async saveStories(rows) { ok(await admin().from('daily_stories').upsert(rows, { onConflict: 'date,lang' })); },
  async saveTopic(row) { ok(await admin().from('story_topics').upsert(row, { onConflict: 'topic_key' })); },
  async saveReminders(rows) { ok(await admin().from('daily_reminders').upsert(rows, { onConflict: 'date,lang' })); },
  async remindersOn(date) { return ok(await admin().from('daily_reminders').select('lang').eq('date', date)) || []; },
  async cronRun(date) { return ok(await admin().from('cron_runs').select('*').eq('date', date).maybeSingle()); },
  async saveCronRun(row) { ok(await admin().from('cron_runs').upsert({ ...row, updated_at: new Date().toISOString() }, { onConflict: 'date' })); },
  async history(lang, limit = 400) {
    const today = new Date().toISOString().slice(0, 10);
    return ok(await admin().from('daily_stories').select('date,lang,title,era,period,teaser,story,lesson,topic_key').eq('lang', lang).lte('date', today).order('date', { ascending: false }).limit(limit)) || [];
  },
  async prophets(lang) { return ok(await admin().from('prophets').select('slug,ord,name,name_ar,title,story,lesson,refs').eq('lang', lang).order('ord')) || []; },
  async premiumContent(kind, lang) { return ok(await admin().from('premium_content').select('payload').eq('kind', kind).eq('lang', lang).maybeSingle())?.payload ?? null; },

  // ----- Suppression de compte -----
  async deleteUserData(userId) {
    ok(await admin().from('favorites').delete().eq('user_id', userId));
    ok(await admin().from('device_links').delete().eq('user_id', userId));
    ok(await admin().from('profiles').delete().eq('user_id', userId));
    ok(await admin().from('subscriptions').update({ user_id: null }).eq('user_id', userId));
  },
};

export const isActiveRow = (row, now = Date.now()) =>
  !!row && ACTIVE.includes(row.status) && (!row.current_period_end || new Date(row.current_period_end).getTime() > now - 86400000);
