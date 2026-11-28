// Notification push « histoire du jour » via l'API REST de OneSignal (une par langue, à 8 h heure locale).
const COPY = {
  fr: ['Votre histoire du jour est arrivée', 'Une nouvelle page de l\'histoire islamique vous attend.'],
  en: ['Your story of the day is here', 'A new page of Islamic history is waiting for you.'],
  ar: ['قصة اليوم بانتظارك', 'صفحة جديدة من التاريخ الإسلامي في انتظارك.'],
  es: ['Tu historia del día ha llegado', 'Una nueva página de la historia islámica te espera.'],
  id: ['Kisah hari ini sudah hadir', 'Satu halaman baru sejarah Islam menantimu.'],
  ur: ['آج کی کہانی حاضر ہے', 'اسلامی تاریخ کا ایک نیا ورق آپ کا منتظر ہے۔'],
};

export async function sendDailyPush({ fetchImpl = fetch } = {}) {
  const appId = process.env.ONESIGNAL_APP_ID, key = process.env.ONESIGNAL_REST_API_KEY || process.env.ONESIGNAL_REST_KEY;
  if (!appId || !key) return { skipped: 'onesignal_not_configured' };
  const results = {};
  for (const [lang, [title, body]] of Object.entries(COPY)) {
    // Français = langue par défaut : reçoit aussi les appareils dont la langue n'est pas l'une des 5 autres.
    const filters = lang === 'fr'
      ? ['en', 'ar', 'es', 'id', 'ur'].flatMap((l, i) => [...(i ? [{ operator: 'AND' }] : []), { field: 'language', relation: '!=', value: l }])
      : [{ field: 'language', relation: '=', value: lang }];
    try {
      const res = await fetchImpl('https://api.onesignal.com/notifications', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Key ${key}` },
        body: JSON.stringify({ app_id: appId, target_channel: 'push', filters, headings: { en: title }, contents: { en: body }, delayed_option: 'timezone', delivery_time_of_day: '8:00AM', ttl: 43200 }),
      });
      results[lang] = res.status;
    } catch (err) { results[lang] = `error:${err.message}`; }
  }
  return results;
}
