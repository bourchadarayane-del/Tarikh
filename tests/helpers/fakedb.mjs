// Fausse base en mémoire : même interface que api/_lib/supabase.js (objet `db`).
export function fakeDb(init = {}) {
  const s = { users: {}, events: new Set(), subs: [], links: {}, stories: [], topics: [], reminders: [], runs: {}, prophets: {}, premium: {}, deleted: [], ...init };
  let id = 1;
  return {
    state: s,
    async userFromToken(token) { return s.users[token] || null; },
    async deleteUser(userId) { s.deleted.push(userId); },
    async recordEvent(source, eventId) { const k = `${source}:${eventId}`; if (s.events.has(k)) return false; s.events.add(k); return true; },
    async forgetEvent(source, eventId) { s.events.delete(`${source}:${eventId}`); },
    async upsertSubscription(row) {
      const clean = Object.fromEntries(Object.entries(row).filter(([, v]) => v !== undefined));
      let cur = s.subs.find((r) => r.source === clean.source && r.external_id === clean.external_id);
      if (cur) Object.assign(cur, clean); else { cur = { id: id++, user_id: null, app_user_id: null, ...clean }; s.subs.push(cur); }
      return cur;
    },
    async getSubscription(source, externalId) { return s.subs.find((r) => r.source === source && r.external_id === externalId) || null; },
    async moveAppUser(from, to) { for (const r of s.subs) if (r.source === 'apple' && from.includes(r.app_user_id)) r.app_user_id = to; },
    async linkedDevices(userId) { return Object.entries(s.links).filter(([, u]) => u === userId).map(([d]) => d); },
    async linkedUser(appUserId) { return s.links[appUserId] || null; },
    async linkDevice(appUserId, userId) { s.links[appUserId] = userId; for (const r of s.subs) if (r.app_user_id === appUserId && !r.user_id) r.user_id = userId; },
    async subscriptionsFor({ userId, appUserId }) {
      const ids = new Set(appUserId ? [appUserId] : []), users = new Set(userId ? [userId] : []);
      if (userId) for (const d of await this.linkedDevices(userId)) ids.add(d);
      if (appUserId && s.links[appUserId]) users.add(s.links[appUserId]);
      return s.subs.filter((r) => (r.user_id && users.has(r.user_id)) || (r.app_user_id && ids.has(r.app_user_id)));
    },
    async storiesOn(date) { return s.stories.filter((r) => r.date === date); },
    async usedTopics() { return s.topics; },
    async saveStories(rows) { for (const r of rows) { s.stories = s.stories.filter((x) => !(x.date === r.date && x.lang === r.lang)); s.stories.push(r); } },
    async saveTopic(row) { s.topics = s.topics.filter((t) => t.topic_key !== row.topic_key); s.topics.push(row); },
    async saveReminders(rows) { for (const r of rows) { s.reminders = s.reminders.filter((x) => !(x.date === r.date && x.lang === r.lang)); s.reminders.push(r); } },
    async remindersOn(date) { return s.reminders.filter((r) => r.date === date); },
    async cronRun(date) { return s.runs[date] || null; },
    async saveCronRun(row) { s.runs[row.date] = { ...(s.runs[row.date] || {}), ...row }; },
    async history(lang) { return s.stories.filter((r) => r.lang === lang).sort((a, b) => b.date.localeCompare(a.date)); },
    async prophets(lang) { return s.prophets[lang] || []; },
    async premiumContent(kind, lang) { return s.premium[`${kind}:${lang}`] ?? null; },
    async deleteUserData(userId) { for (const [d, u] of Object.entries(s.links)) if (u === userId) delete s.links[d]; for (const r of s.subs) if (r.user_id === userId) r.user_id = null; },
  };
}
export const req = (path, { method = 'GET', headers = {}, body } = {}) =>
  new Request(`http://localhost${path}`, { method, headers, body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body) });
