# Fixes to apply in ALL 6 languages (en, fr, ar, es, id, ur) — content/stories/<lang>.json

1. sinan-ottoman-architect
   - story sentence "According to the memoirs he dictated to a friend, he considered the Şehzade Mosque in Istanbul the work of his apprenticeship, the Süleymaniye that of his maturity, and the Selimiye in Edirne, finished when he was in his eighties, his masterpiece."
     -> "A saying long attributed to him calls the Şehzade Mosque in Istanbul the work of his apprenticeship, the Süleymaniye that of his journeyman years, and the Selimiye in Edirne, finished when he was in his eighties, his masterpiece."
   - teaser "He called one of the great mosques of Istanbul the work of an apprentice." -> "He is said to have called one of the great mosques of Istanbul the work of an apprentice."
2. al-biruni-measuring-earth
   - "His result was remarkably close to the value we know today." -> "Converted into modern units, his result is usually reckoned to be within about one or two per cent of today's value, though the exact length of his unit is uncertain."
   - teaser ending "…and came remarkably close." -> "…and by most reckonings came close."
   - "by having teams pace out long distances" -> "by having teams measure out long distances"
3. ibn-battuta-travels: "Late in life he crosses the Sahara to visit the empire of Mali." -> "On his last great journey, he crosses the Sahara to visit the empire of Mali."
4. ibn-sina-canon-of-medicine teaser: "As a teenager he cured a ruler and asked for one reward: access to the royal library." -> "As a teenager he helped treat a ruler and asked for one thing: access to the royal library."
5. mansa-musa-pilgrimage
   - teaser "He gave away so much gold in Cairo that its price was still low twelve years later." -> "He gave away so much gold in Cairo that, a chronicler wrote, its price was still low twelve years later."
   - "…with an Andalusian poet and architect, Abu Ishaq al-Sahili." (+ following sentence about the Djinguereber mosque) -> "…with an Andalusian poet, Abu Ishaq al-Sahili, whom tradition remembers as an architect and credits with the great Djinguereber mosque of Timbuktu, a city that would become a famous centre of learning."
6. musab-ibn-umayr-medina teaser: "…and was sent alone to teach a city…" -> "…and was sent to teach a city…"
7. ibn-al-nafis-pulmonary-circulation teaser: "…written in Cairo three centuries before…" -> "…written three centuries before…"

# content/premium/quiz/<lang>.json
- q083 explain -> "Al-Biruni worked out the radius of the Earth by an ingenious method, with a result close to the modern value, and wrote a detailed book about India."
- q106 explain -> start with "According to tradition, Fatima al-Fihri founded al-Qarawiyyin in Fez, Morocco, in 859." (keep the rest)
- q086 question -> "In which city was the House of Wisdom (Bayt al-Hikma), the famous Abbasid library linked to the translation movement?" ; explain -> "The House of Wisdom was in Abbasid Baghdad, where scholars translated and studied works from Greek, Persian and Indian traditions."

# content/premium/days/<lang>.json — ashura
- Remove the single sentence mentioning the killing of al-Husayn at Karbala (keep the entry about the fast only), in all 6 languages; keep detail >= 110 words.

# Language-specific fixes
- ar — content/stories/ar.json (zheng-he-voyages): replace "الخليج العربي" with the neutral "الخليج" (no "Arabian"/"Persian" qualifier). Do the same neutral wording in every other language if the story says "Persian Gulf" (use "the Gulf" / "le Golfe" / "el Golfo" / "Teluk" / "خلیج").
- es — content/premium/hajj/es.json: replace Spain-only "vosotros" forms and vocabulary with neutral international Spanish (ustedes forms: "pónganse", "rasúrense"; "computadora", "autos", "boletos de avión"). Also align the month spelling with the quiz: use "Dhul-Hiyya" everywhere in es files.
- ur — content/premium/quiz/ur.json q036: remove the honorific from the option(s) so that the honorific does not reveal the answer (all four options must be styled the same way).
- all languages — content/premium/hajj/<lang>.json: verify in the dataset h-eng-bukhari.json that hadith number 1685 is really about continuing the talbiyah until stoning Jamrat al-Aqaba; if it is not, find the correct Bukhari number in the dataset (search "Talbiya" and "Jamra") and replace it in all 6 files, or drop the number.
