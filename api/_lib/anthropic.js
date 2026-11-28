// Génération de l'histoire du jour avec l'API Anthropic.
// 1) rédaction (anglais, JSON strict)  2) contrôle qualité par un second appel « vérificateur de faits »
// 3) traduction du MÊME récit dans les 5 autres langues. La clé reste côté serveur (process.env.ANTHROPIC_KEY).
export const LANGS = ['fr', 'en', 'ar', 'es', 'id', 'ur'];
export const LANG_NAMES = { fr: 'French', en: 'English', ar: 'Modern Standard Arabic', es: 'neutral international Spanish', id: 'standard Indonesian (Bahasa Indonesia)', ur: 'standard Urdu in Arabic script' };
export const CATEGORIES = ['battles', 'companions', 'sciences', 'resistance', 'caliphates', 'medicine', 'modern', 'architecture', 'women', 'discoveries', 'battles', 'travellers', 'dynasties', 'resistance', 'art', 'modern', 'institutions'];
const CATEGORY_HINT = {
  companions: 'a Companion of the Prophet Muhammad ﷺ (character and service, never disputes between Companions)',
  caliphates: 'good governance, justice or administration under a caliphate or sultanate',
  sciences: 'mathematics, astronomy, physics, chemistry or geography by a scholar of the Islamic world',
  medicine: 'medicine, pharmacy, surgery or public health in the Islamic world',
  architecture: 'a mosque, palace, city or work of engineering',
  women: 'a woman scholar, founder, teacher or patron in Islamic history',
  discoveries: 'an invention, technique or discovery and how it spread',
  travellers: 'a traveller, geographer, navigator or trade route',
  dynasties: 'a dynasty, a city or a kingdom of the Islamic world (Africa, Asia or Europe)',
  art: 'calligraphy, books, manuscripts, crafts or poetry',
  institutions: 'a hospital, university, library, waqf or other institution',
  battles: 'a famous battle, siege or campaign of any period (7th to 19th century) and what it teaches: courage, mercy toward the defeated, strategy, honour, the ethics of war, protecting civilians',
  resistance: 'a leader, community or ordinary person who resisted occupation, colonisation or oppression in the 18th-20th century, told through one gripping episode and its moral',
  modern: 'a documented human story from the 20th century or the last decades (events at least 10 years old, with a settled historical record) involving Muslims in war, rescue, exile, resilience or justice: soldiers, doctors, librarians, neighbours who protected others',
};

const RULES = `You write for "Tarikh", a daily Islamic-history app read by Muslims worldwide. The stories must be GRIPPING: a reader should want to finish them and tell someone.
Style:
- 350-450 words in 5 or 6 paragraphs. Open in the middle of a scene or with a striking fact, build tension, give a turning point, land the ending, then the lesson. Concrete details (places, objects, numbers that are well established), short sentences, no lecturing.
- The lesson must feel earned by the story, practical and universal (courage, mercy, honesty, patience, justice, knowledge, loyalty, humility).
Accuracy:
- State only facts firmly established in mainstream historiography. If unsure of a name, date, number or anecdote, leave it out or choose another subject.
- Never invent a quotation, a dialogue, a hadith or a Qur'an reference. Do not quote hadith or Qur'an at all.
- Flag famous but uncertain anecdotes with "tradition relates" or "is reported". Use "about" for figures; give casualty figures only when well established.
Conflicts and wars are welcome when they carry a human story and a moral (courage, mercy, honour, strategy, endurance, protecting civilians, rescue):
- Battles, sieges and campaigns of any period, resistance to occupation, and documented episodes of the 20th century and recent decades (events at least 10 years old with a settled historical record).
- NEVER cover ongoing conflicts or current politics. Do not take sides in contemporary political disputes. Do not blame a people, nation or religion. No dehumanising language about anyone; present adversaries fairly. No graphic cruelty, no glorification of violence or of killing. Atrocities, when needed, are mentioned soberly and briefly: focus on those who resisted, rescued, endured or rebuilt.
- No sectarian issues (Sunni-Shia questions, succession disputes, conflicts between Companions, theological quarrels). No stories about the Prophets themselves.
- Respectful wording; write "the Prophet Muhammad ﷺ" when he is mentioned. No physical description of prophets. Plain, warm language for a general audience. No markdown, no emojis.`;

export function parseJson(text) {
  const s = String(text || '');
  const a = s.indexOf('{'), b = s.lastIndexOf('}');
  if (a < 0 || b <= a) throw new Error('no_json');
  return JSON.parse(s.slice(a, b + 1));
}
export const wordCount = (s) => String(s || '').trim().split(/\s+/).filter(Boolean).length;
export const slugify = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);

// Vérifie la forme du récit ; lève une erreur explicite sinon.
export function validateStory(s, { canonical = false } = {}) {
  for (const k of ['title', 'era', 'period', 'teaser', 'story', 'lesson']) {
    if (typeof s?.[k] !== 'string' || !s[k].trim()) throw new Error(`invalid_story:${k}`);
  }
  if (s.title.length > 90) throw new Error('invalid_story:title_too_long');
  if (canonical) {
    const n = wordCount(s.story);
    if (n < 300 || n > 560) throw new Error(`invalid_story:length_${n}`);
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(s.topic_key || '')) throw new Error('invalid_story:topic_key');
  }
  if (/[<>]|\*\*|^#/m.test(s.story)) throw new Error('invalid_story:markup');
  return { title: s.title.trim(), era: s.era.trim(), period: s.period.trim(), teaser: s.teaser.trim(), story: s.story.trim(), lesson: s.lesson.trim() };
}

export async function callClaude({ system, user, maxTokens = 1500, temperature = 0.7, fetchImpl = fetch }) {
  const key = process.env.ANTHROPIC_KEY;
  if (!key) throw Object.assign(new Error('anthropic_not_configured'), { status: 503 });
  const res = await fetchImpl('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-5', max_tokens: maxTokens, temperature, system, messages: [{ role: 'user', content: user }] }),
  });
  if (!res.ok) throw new Error(`anthropic_http_${res.status}`);
  const data = await res.json();
  return (data.content || []).filter((c) => c.type === 'text').map((c) => c.text).join('');
}

async function draft({ category, avoid, call }) {
  const text = await call({
    system: RULES,
    maxTokens: 2800,
    user: `Write today's story. Theme: ${CATEGORY_HINT[category] || category}.
Choose a subject that is NOT in this list of already-published topic keys (and not a near-duplicate of any of them):
${avoid.slice(0, 500).join(', ') || '(none yet)'}

Return ONLY one JSON object, no other text:
{"topic_key":"lowercase-ascii-slug-naming-the-subject","title":"max 60 characters","era":"e.g. 9th century","period":"e.g. Abbasid Caliphate","teaser":"1-2 sentences that make one want to read","story":"350-450 words in 5-6 paragraphs separated by \\n\\n, told like a gripping story","lesson":"1-2 sentences, universal and practical, earned by the story","claims":["every factual claim of the story, one per item"]}`,
  });
  const raw = parseJson(text);
  return { ...validateStory(raw, { canonical: true }), topic_key: raw.topic_key, category, claims: Array.isArray(raw.claims) ? raw.claims.map(String) : [] };
}

// Second appel indépendant : rejette le récit au moindre doute.
async function factCheck(story, call) {
  const text = await call({
    system: 'You are a strict, sceptical fact-checker specialised in the history of Islamic civilisation. You approve a text only if every factual claim is firmly established. Any doubt means rejection.',
    temperature: 0,
    maxTokens: 1200,
    user: `Check this story for a daily app. Look for: wrong or doubtful names, dates, places, numbers (casualty figures especially); legends presented as fact; invented quotations or dialogue; hadith or Qur'an quotations; sectarian controversy; taking sides in a contemporary political dispute, blaming a people or religion, covering an ongoing conflict, or events less than 10 years old; graphic cruelty or glorification of violence; disrespectful wording. A war story is acceptable only if it is accurate, fair to all sides and carries a human moral.

TITLE: ${story.title}
ERA: ${story.era} — ${story.period}
TEASER: ${story.teaser}
STORY: ${story.story}
LESSON: ${story.lesson}
CLAIMS LISTED BY THE AUTHOR: ${JSON.stringify(story.claims)}

Return ONLY one JSON object: {"verdict":"pass" or "fail","issues":["each problem, precisely"]}`,
  });
  const out = parseJson(text);
  return { pass: out.verdict === 'pass' && !(out.issues || []).length, issues: Array.isArray(out.issues) ? out.issues.map(String) : [] };
}

async function translate(story, lang, call) {
  const text = await call({
    system: `You are a professional translator into ${LANG_NAMES[lang]}. Translate faithfully and naturally: same facts, nothing added or removed, same hedges. Keep the sign ﷺ. Use the names customary in the target language. No markdown.`,
    temperature: 0.2,
    maxTokens: 4500,
    user: `Translate the values of this JSON into ${LANG_NAMES[lang]}. Keep the keys and the paragraph breaks (\\n\\n). Return ONLY the JSON object.
${JSON.stringify({ title: story.title, era: story.era, period: story.period, teaser: story.teaser, story: story.story, lesson: story.lesson })}`,
  });
  const out = validateStory(parseJson(text));
  if (out.story.split(/\n{2,}/).length !== story.story.split(/\n{2,}/).length) out.story = out.story.replace(/\n+/g, '\n\n');
  return out;
}

// Renvoie { topic_key, category, stories: { fr: {...}, en: {...}, ... }, attempts } ou lève une erreur après 3 essais.
export async function generateDailyStory({ category, usedTopics = [], call = callClaude, attempts = 3 } = {}) {
  const used = new Set(usedTopics);
  const avoid = [...used];
  const errors = [];
  for (let i = 1; i <= attempts; i++) {
    try {
      const en = await draft({ category, avoid, call });
      const key = slugify(en.topic_key);
      if (used.has(key)) { avoid.push(key); throw new Error(`duplicate_topic:${key}`); }
      const check = await factCheck(en, call);
      if (!check.pass) { avoid.push(key); throw new Error(`fact_check_failed:${check.issues.join(' | ').slice(0, 300)}`); }
      const others = await Promise.all(LANGS.filter((l) => l !== 'en').map(async (l) => [l, await translate(en, l, call)]));
      const { claims, topic_key, category: cat, ...enStory } = en;
      return { topic_key: key, category: cat, stories: { en: enStory, ...Object.fromEntries(others) }, attempts: i };
    } catch (err) { errors.push(`#${i} ${err.message}`); }
  }
  throw new Error(`generation_failed: ${errors.join(' ; ')}`);
}
