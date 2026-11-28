# Tarikh — content schemas and editorial rules

Languages (always these 6 codes): `fr`, `en`, `ar`, `es`, `id`, `ur`.

## Editorial rules (mandatory for every content file)

1. Accuracy first. Only state facts that are firmly established. If unsure about a fact, a date or a name, leave it out or pick another subject. Never invent a quotation, a hadith, a verse reference or a number.
2. No sectarian controversy. Stay on ground shared by mainstream Muslims. Do not attack or favour any school or group. Where scholars differ (e.g. the date of the Mawlid, the exact night of Laylat al-Qadr), say neutrally that opinions differ.
3. Respectful wording. Use "the Prophet Muhammad ﷺ" (keep the ﷺ sign in every language) and "peace be upon him" style honorifics for prophets in the natural form of each language. No depiction or physical description of prophets.
4. Qur'an references are written `Surah:Ayah` with the surah number, e.g. `2:255` or a range `12:4-6`. Only cite references you are certain of.
5. Hadith are quoted only with a precise reference (collection + number) and only from sound collections (al-Bukhari, Muslim, or hadith graded sahih/hasan in the Sunan). Never paraphrase a hadith as a direct quote.
6. Plain, warm, modern language a 14-year-old can follow. No markdown, no HTML, no emojis inside JSON string values. Paragraphs inside a string are separated by `\n\n`.
7. Files are UTF-8 JSON, 2-space indented, valid (`node -e "JSON.parse(require('fs').readFileSync(f,'utf8'))"` must pass). Use real characters, not \u escapes.
8. Translations must carry exactly the same facts, the same ids/keys and the same order as the English file. Natural, idiomatic phrasing — not word for word. Arabic: Modern Standard Arabic. Urdu: standard Urdu in Arabic script. Indonesian: standard Bahasa Indonesia. Spanish: neutral international Spanish.

## Public data (bundled in the app) — `web/data/`

### `names99.json`
Array of exactly 99 objects, standard list (at-Tirmidhi), in order:
`{ "n": 1, "ar": "الرَّحْمَٰنُ", "tr": "Ar-Rahman", "m": { "fr": "...", "en": "...", "ar": "...", "es": "...", "id": "...", "ur": "..." } }`
`m.<lang>` = short meaning (max ~8 words). `m.ar` = a short Arabic gloss of the meaning.

### `days.json`
Array of symbolic days of the Hijri year:
`{ "id": "ashura", "month": 1, "day": 10, "endDay": null, "kind": "gold" | "fast" | "both", "title": {6 langs}, "short": {6 langs} }`
`short` = 1–2 sentences. `endDay` is used for ranges inside one month (e.g. Tashriq 11–13).

### `hadiths.json` (daily reminder pool)
`{ "id": "bukhari-1", "collection": "bukhari" | "muslim", "number": 1, "ar": "<Arabic matn, vocalised, copied from the source dataset, without the chain>", "narrator": {6 langs}, "t": {6 langs}, "ref": {6 langs} }`
`ref.<lang>` e.g. "Sahih al-Bukhari, n° 1".

### `duas.json`
`{ "id": "rabbana-atina", "cat": "quran" | "morning-evening" | "daily" | "distress" | "travel" | "forgiveness" | "family", "title": {6 langs}, "ar": "...", "tr": "<latin transliteration>", "t": {6 langs}, "source": {6 langs}, "quran": "2:201" | null }`

### `adhkar.json`
`{ "after-prayer": [ item ], "morning": [ item ], "evening": [ item ], "sleep": [ item ] }`
item = `{ "id": "...", "ar": "...", "tr": "...", "t": {6 langs}, "count": 33, "source": {6 langs} }`

## Seed stories — `content/stories/<lang>.json`  (REVISED RULES, supersede rule 2 above for stories)
Array of objects, same order and ids in every language:
`{ "topic_key": "omar-mukhtar-desert-lion", "category": "resistance", "title": "...", "era": "XXe siècle", "period": "Libye sous occupation italienne", "teaser": "<2 sentences that make one want to read>", "story": "<350–450 words, 5–6 paragraphs separated by \n\n>", "lesson": "<1–2 sentences>" }`
Categories: companions, caliphates, sciences, medicine, architecture, women, discoveries, travellers, dynasties, art, institutions, **battles**, **resistance**, **modern**.

Style: gripping. Open in the middle of a scene or with a striking fact; build tension; a turning point; an ending that lands; then the lesson, earned by the story. Concrete well-established details, short sentences, no lecturing.

Wars and conflicts ARE welcome when they carry a human story and a moral (courage, mercy toward the defeated, honour, strategy, endurance, protecting civilians, rescue): battles and sieges of any period, resistance to occupation, and documented episodes of the 20th century and recent decades — events at least 10 years old with a settled historical record. Hard limits:
- No ongoing conflict, no current politics, no taking sides in contemporary political disputes, no blaming a people, nation or religion, no dehumanising language, no graphic cruelty, no glorification of violence. Present adversaries fairly. Atrocities only soberly and briefly; focus on those who resisted, rescued, endured or rebuilt.
- Casualty figures only when well established ("about", ranges) — otherwise omit.
- Still no sectarian issues (Sunni–Shia, succession disputes, conflicts between Companions, theological quarrels) and no stories about the Prophets.
- Accuracy rules 1 and 5 stay in force: no invented quotation or dialogue; legends flagged "tradition relates" / "is reported"; when unsure, drop the detail or the subject.

## Premium content — `content/premium/`

### `prophets/<lang>.json`
Array of 25 objects in the traditional order (Adam … Muhammad ﷺ):
`{ "slug": "adam", "ord": 1, "name": "Adam", "name_ar": "آدم", "title": "<short epithet>", "story": "<300–500 words, paragraphs separated by \n\n>", "lesson": "<1–2 sentences>", "refs": ["2:30-37", "7:11-25"] }`
Stories rely on the Qur'an and sound hadith only — no isra'iliyyat details presented as fact.

### `hajj/<lang>.json`
`{ "umrah": { "title": "...", "intro": "...", "chapters": [ { "id": "ihram", "title": "...", "body": "...", "steps": ["..."], "duas": [ { "ar": "...", "tr": "...", "t": "...", "source": "..." } ] } ] }, "hajj": { same shape, chapters by day: 8, 9, 10, 11–13 Dhul-Hijja, farewell tawaf }, "mistakes": [ { "title": "...", "body": "..." } ], "checklist": [ { "id": "passport", "group": "documents" | "clothing" | "health" | "spiritual", "label": "..." } ] }`

### `quiz/<lang>.json`
Array of 120 objects, same ids and order in every language:
`{ "id": "q001", "cat": "prophets" | "seerah" | "companions" | "quran" | "history" | "sciences" | "pillars" | "civilisation", "q": "...", "options": ["...", "...", "...", "..."], "answer": 0, "explain": "<1–2 sentences>" }`
`answer` = index of the correct option. The correct option position must vary across questions.

### `days/<lang>.json`
Object keyed by the `id` used in `web/data/days.json`:
`{ "ashura": { "detail": "<120–200 words: history, what is recommended, sources>", "sources": ["Sahih Muslim 1162"] } }`
