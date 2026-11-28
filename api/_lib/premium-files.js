// Contenu Premium embarqué avec le serveur : sert de source quand la base (tables `prophets` et `premium_content`)
// n'a pas été remplie avec supabase/seed.sql. Le contrôle d'abonnement reste fait avant (premium-content.js).
// Les imports sont statiques pour que Vercel inclue les fichiers dans la fonction.
import prophetsFr from '../../content/premium/prophets/fr.json' with { type: 'json' };
import prophetsEn from '../../content/premium/prophets/en.json' with { type: 'json' };
import prophetsAr from '../../content/premium/prophets/ar.json' with { type: 'json' };
import prophetsEs from '../../content/premium/prophets/es.json' with { type: 'json' };
import prophetsId from '../../content/premium/prophets/id.json' with { type: 'json' };
import prophetsUr from '../../content/premium/prophets/ur.json' with { type: 'json' };
import hajjFr from '../../content/premium/hajj/fr.json' with { type: 'json' };
import hajjEn from '../../content/premium/hajj/en.json' with { type: 'json' };
import hajjAr from '../../content/premium/hajj/ar.json' with { type: 'json' };
import hajjEs from '../../content/premium/hajj/es.json' with { type: 'json' };
import hajjId from '../../content/premium/hajj/id.json' with { type: 'json' };
import hajjUr from '../../content/premium/hajj/ur.json' with { type: 'json' };
import quizFr from '../../content/premium/quiz/fr.json' with { type: 'json' };
import quizEn from '../../content/premium/quiz/en.json' with { type: 'json' };
import quizAr from '../../content/premium/quiz/ar.json' with { type: 'json' };
import quizEs from '../../content/premium/quiz/es.json' with { type: 'json' };
import quizId from '../../content/premium/quiz/id.json' with { type: 'json' };
import quizUr from '../../content/premium/quiz/ur.json' with { type: 'json' };
import daysFr from '../../content/premium/days/fr.json' with { type: 'json' };
import daysEn from '../../content/premium/days/en.json' with { type: 'json' };
import daysAr from '../../content/premium/days/ar.json' with { type: 'json' };
import daysEs from '../../content/premium/days/es.json' with { type: 'json' };
import daysId from '../../content/premium/days/id.json' with { type: 'json' };
import daysUr from '../../content/premium/days/ur.json' with { type: 'json' };

const FILES = {
  prophets: { fr: prophetsFr, en: prophetsEn, ar: prophetsAr, es: prophetsEs, id: prophetsId, ur: prophetsUr },
  hajj: { fr: hajjFr, en: hajjEn, ar: hajjAr, es: hajjEs, id: hajjId, ur: hajjUr },
  quiz: { fr: quizFr, en: quizEn, ar: quizAr, es: quizEs, id: quizId, ur: quizUr },
  days: { fr: daysFr, en: daysEn, ar: daysAr, es: daysEs, id: daysId, ur: daysUr },
};

export const premiumFromFiles = (kind, lang) => FILES[kind]?.[lang] ?? null;
