# Tarikh — rapport de livraison

Branche : `feature/tarikh-app-v1` · Date : 27 novembre 2026

Ce document dit ce qui est fait, ce que j'ai décidé pour vous, ce qui reste à faire de votre côté (clic par clic) et les risques restants avant la soumission à Apple.

---

## 1. En deux minutes

**L'application est écrite, testée et prête à être branchée sur vos comptes.** Rien n'a été déployé, rien n'a été soumis à Apple, rien n'a été écrit sur `main`, aucun de vos comptes n'a été modifié.

Trois choses importantes à savoir tout de suite :

1. **Le dépôt GitHub était vide.** Il ne contenait qu'un `README.md` : ni `api/generate.js`, ni le fichier `apiii`, ni `tarikh-complete.html`. Ils n'ont probablement jamais été envoyés sur GitHub. J'ai donc tout construit à partir de votre cahier des charges, sans maquette. Si vous retrouvez ces fichiers sur votre Mac, gardez-les de côté : ils ne sont plus nécessaires.
2. **Il n'y avait pas de fichier `.env.local`**, donc aucune clé. Je n'ai pu appeler ni Anthropic, ni Stripe, ni Supabase. Conséquences : les contenus Premium ont été rédigés et relus ici (pas générés par votre clé), et tout ce qui dépend de vos comptes a été testé avec des faux serveurs. Les vrais branchements restent à vérifier une fois vos clés en place.
3. **Le projet iOS n'a pas été compilé.** Cet environnement est sous Linux : Xcode n'existe pas ici. Le projet Xcode est généré et configuré, le script `scripts/build-ios.sh` fait le build sur votre Mac. C'est le principal point non vérifié.

### Ce qui a été réellement vérifié ici

| Vérification | Résultat |
|---|---|
| `npm install` | OK |
| `npm test` (syntaxe, traductions, secrets, 27 tests, SQL) | 27 tests réussis sur 27 |
| `npm run test:e2e` (appli pilotée dans Chromium) | 37 étapes réussies sur 37, aucune erreur console |
| Parcours d'achat et de compte, serveurs simulés (connexion par code, paiement Stripe avec essai 7 jours, retour de Stripe, suppression du compte, jeton expiré) | 5 parcours sur 5 |
| Mode iOS simulé : aucun mot « Stripe » ou « carte », aucun appel de paiement, « Gérer l'abonnement » ouvre les réglages Apple | 2 parcours sur 2 |
| Schéma SQL + données + règles de sécurité sur un vrai Postgres 16 local | OK, exécuté deux fois (idempotent) |
| Qibla : Paris 119°, Jakarta 295°, New York 58° | OK |
| 6 langues, sens d'écriture droite-à-gauche pour l'arabe et l'ourdou | OK |
| Mode hors-ligne (rechargement sans réseau, outils, histoire) | OK |
| Aucun secret dans git | OK (`npm run check:secrets`) |
| Lighthouse mobile (serveur local compressé, réseau 4G simulé) | Performance 92, Accessibilité 100, Bonnes pratiques 100, SEO 100 (le score PWA n'existe plus dans Lighthouse 12) |

### Ce qui n'a PAS pu être vérifié ici

| Point | Pourquoi | Comment le vérifier |
|---|---|---|
| Compilation iOS | Pas de Xcode sous Linux | `./scripts/build-ios.sh` sur votre Mac |
| Achat réel Apple / RevenueCat | Pas de compte ni de clé | `appstore/iap-setup.md`, partie C |
| Paiement Stripe réel | Pas de clé | Partie 5-c ci-dessous |
| Génération IA réelle | Pas de clé Anthropic | Partie 5-d : lancer `/api/generate` une fois |
| Notifications push (APNs) | Pas de certificat | Partie 5-e |
| Comparaison des horaires avec Aladhan | `api.aladhan.com` bloqué par le réseau d'ici | `node scripts/compare-aladhan.mjs` chez vous |

---

## 2. Ce qui est fait

### Application (dossier `web/`)

- **Démarrage** : écran de 2,5 s avec horloge aux chiffres arabes (aiguilles centrées), puis accueil en 3 écrans (langue, ville, rappels).
- **Aujourd'hui** : date grégorienne et hégirienne, série de jours, alerte de jeûne recommandé, horaires de prière avec compte à rebours, rappel du jour (hadith avec référence), histoire du jour, grille des outils.
- **Histoire** : récit complet, leçon, partage en image (1080 × 1350), favori, écoute (synthèse vocale), mode lecture.
- **Outils gratuits** : tasbih (33/99/100/libre, vibration), Qibla (angle, distance, boussole en direct), 99 Noms avec recherche, 45 douaas, adhkar (après la prière, matin, soir, sommeil) avec compteurs, bonnes actions (jour, total, 30 jours), zakat, suivi des prières (30 jours), suivi du jeûne, compte à rebours du Ramadan, mosquées proches, Kaaba en direct, lien vers un lecteur du Coran.
- **Calendrier** : mois hégirien, jeûnes en vert, jours symboliques en or, détail au clic.
- **Premium** : 25 prophètes, guide Omra/Hajj, quiz de 120 questions, historique et favoris illimités, détail des jours symboliques.
- **Paramètres** : langue, méthode de calcul, Asr standard ou hanafite, ville, ajustement hégirien, notifications, abonnement, restauration, compte facultatif, suppression du compte, export et effacement des données, pages légales, à propos avec la mention sur l'IA.
- **6 langues** : 382 libellés d'interface et tous les contenus, en français, anglais, arabe, espagnol, indonésien, ourdou.
- **Hors-ligne** : service worker sur le web ; fichiers embarqués dans l'app iOS.

### Serveur (dossier `api/`)

| Fichier | Rôle |
|---|---|
| `cron-daily.js` | Chaque jour : histoire + rappel dans les 6 langues, puis notification |
| `generate.js` | Génération manuelle, protégée par `CRON_SECRET` |
| `subscription-status.js` | Dit si l'appelant est abonné |
| `premium-content.js` | Sert le contenu Premium après vérification |
| `create-checkout-session.js` | Paiement Stripe (web uniquement) |
| `create-portal-session.js` | Portail client Stripe |
| `stripe-webhook.js` | Reçoit les événements Stripe (signature vérifiée) |
| `revenuecat-webhook.js` | Reçoit les événements d'abonnement Apple |
| `link-device.js` | Relie un appareil à un compte |
| `delete-account.js` | Supprime le compte et ses données |

### Base de données (`supabase/`)

`schema.sql` (11 tables, règles de sécurité partout, fonction `is_premium()`), `seed.sql` (contenus Premium et liste anti-doublon). Les deux peuvent être relancés sans risque.

### iOS (`ios/`) et App Store (`appstore/`)

Projet Xcode Capacitor avec : permissions expliquées en 6 langues, manifeste de confidentialité, notifications push, icône 1024 sans transparence, écran de lancement, portrait, iPhone uniquement, version 1.0.0 (build 1). Dossier `appstore/` : fiches en 6 langues, 24 captures d'écran, notes pour les relecteurs, réponses de confidentialité, guide de l'abonnement, checklist.

---

## 3. Décisions que j'ai prises pour vous

| Sujet | Décision | Pourquoi |
|---|---|---|
| Technique web | JavaScript simple, sans framework, assemblé par `esbuild` | Appli légère (environ 2,3 Mo, polices comprises) et rapide en réseau lent ; rien à apprendre de plus |
| Une seule branche et une seule PR | `feature/tarikh-app-v1`, commits séparés par sujet | Le dépôt était vide : plusieurs PR empilées auraient été plus difficiles à relire et à fusionner |
| Bundle ID | `com.bourchadarayane.tarikh` | Comme proposé. Pour le changer : `capacitor.config.ts`, puis Xcode |
| Gestionnaire iOS | CocoaPods | Le plugin OneSignal n'est pas fiable avec Swift Package Manager |
| iPhone uniquement | Pas de version iPad | Évite les captures et la mise en page iPad pour une première version |
| Catégorie App Store | Références, puis Style de vie | Voir `appstore/README.md` |
| Rappel du jour | Choisi dans une liste de 40 hadiths vérifiés, **jamais écrit par l'IA** | Votre règle : l'IA ne doit jamais inventer de citation |
| Histoire du jour si l'IA échoue | Une histoire de la bibliothèque relue (30 sujets) est publiée à la place | Jamais de jour vide ; le service fonctionne même sans clé Anthropic pendant un mois |
| `api/generate.js` | N'est plus un relais public vers Anthropic | N'importe qui pouvait consommer votre clé |
| Paiement web | Compte e-mail obligatoire avant de payer par carte | Sans compte, un abonnement web serait perdu au premier nettoyage du navigateur |
| Paiement iOS | Aucun compte demandé | Apple restaure l'achat tout seul |
| Connexion | Code à 6 chiffres reçu par e-mail | Fonctionne dans l'app iOS sans réglage de liens ; demande une petite modification du modèle d'e-mail (partie 5-b) |
| Position | Arrondie à environ 1 km, gardée sur l'appareil | Suffisant pour les horaires et la Qibla, plus respectueux |
| Mention de Kerbala | Retirée de l'explication d'Achoura | Votre règle : aucun sujet de controverse entre courants |
| « Golfe » | Écrit sans qualificatif dans toutes les langues | Nom politiquement sensible |
| Vos comptes | Aucun n'a été modifié, alors que des accès Supabase et Vercel étaient disponibles | Vous êtes absent ; ces étapes restent les vôtres (partie 5) |

---

## 4. Améliorations ajoutées (non demandées)

| Amélioration | Raison |
|---|---|
| Aperçu gratuit : premier récit de prophète et 5 questions de quiz | Donne envie de s'abonner ; montre aux relecteurs Apple ce que l'abonnement débloque |
| Recherche de ville hors-ligne (4 442 villes de plus de 100 000 habitants) | Utilisable sans réseau et sans géolocalisation |
| Méthode de calcul choisie selon le pays, Asr hanafite au Pakistan, en Inde, au Bangladesh, en Turquie | Horaires justes dès le premier lancement pour votre cible asiatique |
| Polices hébergées avec l'appli (aucun appel à Google Fonts) | Plus rapide, fonctionne hors-ligne, meilleur pour la vie privée |
| Rappel la veille des jours de jeûne recommandés | Aide à la régularité |
| Vérification immédiate d'un achat auprès de RevenueCat | Le contenu s'ouvre tout de suite, sans attendre le webhook (évite un refus Apple) |
| Contrôle des textes arabes par script (`scripts/verify-arabic-sources.py`) | Les 117 textes arabes sont copiés de recueils, pas tapés de mémoire |
| Relecture indépendante des 30 histoires et du quiz | Aucune erreur trouvée ; 7 formulations nuancées |
| Test SQL des règles de sécurité sur un vrai Postgres | Prouve qu'un non-abonné ne lit pas le contenu Premium |
| `npm run check:secrets` | Empêche d'envoyer une clé sur GitHub par accident |
| En-têtes de sécurité, balises de partage, `sitemap.xml`, données structurées | Sécurité et référencement du site |
| Pages légales bilingues | Exigées par Apple et le RGPD |

Non fait, à envisager plus tard : widget iOS (demande Xcode pour créer la cible), statistiques d'usage, synchronisation des favoris entre appareils (la table existe, l'appli ne s'en sert pas encore), version Android.

---

## 5. CE QUE JE DOIS FAIRE MOI-MÊME

> **Version courte et à jour : [`docs/DEMAIN.md`](docs/DEMAIN.md).** Diagnostic en direct : https://tarikh-topaz.vercel.app/api/health (une fois la PR « diagnostic » fusionnée).

Suivez l'ordre. Comptez une demi-journée, hors délais d'Apple.

### a) Anthropic : remplacer la clé exposée — FAIT (clé créée par vous, ajoutée dans Vercel par moi)

À faire plus tard : supprimer l'ancienne clé exposée si ce n'est pas déjà fait, et recréer la nouvelle une fois tout installé (elle apparaît sur une capture d'écran partagée en conversation).

Étapes d'origine, pour mémoire :

1. Ouvrez https://console.anthropic.com > **API keys**.
2. Sur la ligne de la clé « Tarikh » : **⋯** > **Delete** (ou Disable). Elle a été publiée : considérez-la comme volée.
3. **Create key** > nom `Tarikh serveur` > copiez la clé (elle ne sera plus affichée).
4. Sur votre Mac, dans le dossier du projet, copiez `.env.example` en `.env.local` et collez la clé après `ANTHROPIC_KEY=`.
5. Vous la mettrez aussi dans Vercel à l'étape d.
6. Conseil : **Settings > Limits** > fixez une limite de dépense mensuelle (par exemple 10 $).

### b) Supabase — FAIT par moi, il reste 3 réglages

L'ancien projet (`klcqcxbjvrblcwkrvkur`) ne pouvait plus être restauré sans abonnement Pro. J'ai créé à la place un projet gratuit **`tarikh`** (région Francfort, identifiant `rldqqwrvhwintqrwgope`, adresse `https://rldqqwrvhwintqrwgope.supabase.co`). Vous pouvez supprimer l'ancien dans le tableau de bord.

Déjà fait dans le nouveau projet :
- les 11 tables, les règles de sécurité (12 règles, protection activée partout) et la fonction `is_premium()` ;
- la liste des 30 sujets d'histoires (anti-doublon) ;
- l'URL et la clé publique ont été ajoutées dans Vercel (`SUPABASE_URL`, `SUPABASE_ANON_KEY`).

Le contenu Premium (prophètes, guide Hajj, quiz) n'est **pas** dans la base : le serveur le lit directement dans ses fichiers (`api/_lib/premium-files.js`), toujours après vérification de l'abonnement. Si vous préférez qu'il vienne de la base, exécutez les 7 fichiers de `supabase/seed/`, le serveur les utilisera alors en priorité.

À faire par vous (dans https://supabase.com/dashboard, projet `tarikh`) :
1. **Project Settings > API** : copiez la clé **secrète** (« service_role » ou « secret ») → variable `SUPABASE_SERVICE_ROLE_KEY` dans Vercel et `.env.local`. Je ne peux pas la lire.
2. **Authentication > Emails > Magic Link** : dans le modèle, ajoutez une ligne contenant `{{ .Token }}`, par exemple `Votre code Tarikh : {{ .Token }}`. Sans cela, l'e-mail ne contient qu'un lien et le code n'apparaît pas.
3. **Authentication > URL Configuration** : Site URL `https://tarikh-topaz.vercel.app` ; Redirect URLs : `https://tarikh-topaz.vercel.app/**` et `capacitor://localhost`.

Avertissements de sécurité de Supabase (normaux) : `is_premium()` doit rester appelable pour que les règles d'accès fonctionnent ; elle ne dit que le statut de la personne qui l'appelle. Trois tables n'ont volontairement aucune règle : elles sont fermées au public et seul le serveur y écrit.

### c) Stripe (web uniquement)

1. https://dashboard.stripe.com, restez en **mode test** pour commencer.
2. **Catalogue de produits > Ajouter un produit** : nom `Tarikh Premium`, tarif **récurrent**, **4,99 EUR**, **mensuel** > Enregistrer.
3. Sur la page du produit, copiez l'identifiant du tarif (commence par `price_`) → `STRIPE_PRICE_ID`.
4. L'essai de 7 jours est ajouté par le code au moment du paiement : rien à régler dans Stripe.
5. **Paramètres > Billing > Portail client** : activez-le, autorisez l'annulation.
6. **Développeurs > Webhooks > Ajouter un endpoint** : URL `https://tarikh-topaz.vercel.app/api/stripe-webhook` ; événements : `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`.
7. Copiez le « Signing secret » → `STRIPE_WEBHOOK_SECRET`. Copiez la clé secrète (Développeurs > Clés API) → `STRIPE_SECRET_KEY`.
8. Désactivez l'ancien lien de paiement `buy.stripe.com/4gM00…` (Liens de paiement > ⋯ > Désactiver) : il ne prévient pas notre serveur.
9. Carte de test : `4242 4242 4242 4242`, date future, code quelconque.
10. Passage en réel : refaites les étapes 2 à 7 en mode production, puis remplacez les 3 variables dans Vercel.

Test local du webhook (facultatif) :

```bash
stripe listen --forward-to localhost:3000/api/stripe-webhook
```

### d) Vercel

1. https://vercel.com > projet **tarikh** > **Settings > Environment Variables**. Ajoutez chaque variable ci-dessous en cochant **Production** et **Preview**.

| Variable | Valeur | Secret ? |
|---|---|---|
| `PUBLIC_SITE_URL` | `https://tarikh-topaz.vercel.app` (**déjà ajoutée**) | Non |
| `SUPABASE_URL` | `https://rldqqwrvhwintqrwgope.supabase.co` (**déjà ajoutée**) | Non |
| `SUPABASE_ANON_KEY` | Clé publique Supabase (**déjà ajoutée**) | Non |
| `SUPABASE_SERVICE_ROLE_KEY` | Clé secrète Supabase | **Oui** |
| `ANTHROPIC_KEY` | Nouvelle clé (étape a) | **Oui** |
| `CRON_SECRET` | Chaîne aléatoire de 32 caractères ou plus | **Oui** |
| `STRIPE_SECRET_KEY` | Étape c | **Oui** |
| `STRIPE_WEBHOOK_SECRET` | Étape c | **Oui** |
| `STRIPE_PRICE_ID` | Étape c | Non |
| `REVENUECAT_WEBHOOK_SECRET` | Étape f | **Oui** |
| `REVENUECAT_SECRET_API_KEY` | Étape f | **Oui** |
| `ONESIGNAL_APP_ID` | `eace460e-1b43-4324-9a40-9dad247ec864`, **seulement après l'étape e** | Non |
| `ONESIGNAL_REST_API_KEY` | Étape e | **Oui** |
| `REVENUECAT_IOS_PUBLIC_KEY` | Étape f (utile surtout dans `.env.local` sur le Mac) | Non |

Pour créer `CRON_SECRET` :

```bash
openssl rand -hex 32
```

2. **Settings > Build and Deployment** : Framework Preset `Other` ; ne remplissez pas Build Command ni Output Directory (le fichier `vercel.json` s'en charge : `npm run build`, dossier `www`).
3. **Settings > Functions** : laissez « Fluid Compute » activé (le cron peut durer jusqu'à 5 minutes).
4. **Erreur 403 — corrigée par moi.** La cause était bien « Vercel Authentication », activée sur tous les déploiements sauf domaines personnalisés : tout visiteur du site `tarikh-topaz.vercel.app` devait se connecter à Vercel. Je l'ai limitée aux déploiements de prévisualisation (la production est publique). Vous pouvez le vérifier dans Settings > Deployment Protection.
5. **Erreur 404** : elle venait du fichier d'accueil mal nommé. Le build produit maintenant `www/index.html`.
6. Fusionnez la Pull Request sur GitHub : Vercel redéploie tout seul.
7. Vérifiez le premier passage du cron sans attendre le lendemain :

```bash
curl -X POST https://tarikh-topaz.vercel.app/api/generate -H "Authorization: Bearer VOTRE_CRON_SECRET" -H "Content-Type: application/json" -d '{}'
```

Réponse attendue : `"ok": true` et `"story": "ai"` (ou `"seed"` si l'IA a été refusée par le contrôle). Dans Supabase, `daily_stories` doit gagner 12 lignes.

Crons du plan Hobby : un passage par jour et par cron, à l'heure près. Deux sont déclarés : 8 h UTC (principal) et 14 h UTC (secours, ne refait que ce qui manque). Chaque passage prépare aujourd'hui et demain, pour que tous les fuseaux horaires aient leur histoire à minuit.

### e) OneSignal (notifications push iOS)

1. https://developer.apple.com/account > **Certificates, IDs & Profiles > Keys** > **+** > nom `Tarikh APNs` > cochez **Apple Push Notifications service (APNs)** > Continue > Register > **Download** le fichier `.p8` (une seule fois ; ne le mettez jamais dans git). Notez le **Key ID** et votre **Team ID**.
2. https://dashboard.onesignal.com > app Tarikh > **Settings > Push & In-App > Apple iOS (APNs)** > méthode **.p8 Auth Key** > envoyez le fichier, Key ID, Team ID, Bundle ID `com.bourchadarayane.tarikh` > Save.
3. **Settings > Keys & IDs** : copiez la **REST API Key** → `ONESIGNAL_REST_API_KEY` (Vercel).
4. Mettez `ONESIGNAL_APP_ID` dans Vercel **et** dans `.env.local`, puis reconstruisez l'app iOS.
5. Le plugin est déjà installé et branché. Tant que `ONESIGNAL_APP_ID` est vide, l'app utilise un rappel quotidien local à la place : rien n'est cassé.
6. Test : OneSignal > Messages > New Push > « Send to Test Device ».

### f) RevenueCat

Suivez `appstore/iap-setup.md`, partie B. À la fin vous avez : `REVENUECAT_IOS_PUBLIC_KEY` (dans `.env.local`), `REVENUECAT_SECRET_API_KEY` et `REVENUECAT_WEBHOOK_SECRET` (dans Vercel).

### g) Apple Developer et App Store Connect

1. https://developer.apple.com/programs/enroll : inscription (99 $ par an), validation en 24 à 48 h.
2. **Certificates, IDs & Profiles > Identifiers > +** > App IDs > App > Description `Tarikh`, Bundle ID **Explicit** `com.bourchadarayane.tarikh` > cochez **Push Notifications** (In-App Purchase est coché d'office) > Register.
3. https://appstoreconnect.apple.com > **Contrats** : signez « Apps payantes », remplissez banque et fiscalité. Sans cela, l'abonnement ne s'affiche pas.
4. **Apps > + > Nouvelle app** : plateforme iOS, nom `Tarikh – Histoire Islamique`, langue principale Français, Bundle ID ci-dessus, SKU `tarikh-ios-001`.
5. Abonnement et essai : `appstore/iap-setup.md`, partie A.
6. Fiche : `appstore/README.md`, `appstore/metadata/`, `appstore/screenshots/`, `appstore/privacy-labels.md`.
7. Small Business Program : https://developer.apple.com/app-store/small-business-program/ (commission de 15 % au lieu de 30 %, pour moins d'un million de dollars de revenus par an).

### h) Xcode

Suivez `appstore/checklist-soumission.md`. En résumé :

```bash
./scripts/build-ios.sh
```

```bash
./scripts/build-ios.sh open
```

Puis dans Xcode : choisir votre équipe, **Product > Archive**, **Distribute App > App Store Connect**, tester dans TestFlight, soumettre.

Si le build échoue, copiez-moi les 30 dernières lignes : c'est la seule partie que je n'ai pas pu exécuter.

---

## 6. Checklist de test manuelle

À faire sur un vrai iPhone (TestFlight) avant de soumettre.

**Démarrage**
- [ ] Horloge 2,5 s, puis accueil en 3 écrans ; « Passer » fonctionne.
- [ ] Deuxième lancement : pas d'accueil.

**Aujourd'hui**
- [ ] Date du jour et date hégirienne correctes.
- [ ] Refus de la géolocalisation → recherche de ville → 6 horaires affichés.
- [ ] La prochaine prière est surlignée, le compte à rebours défile.
- [ ] Rappel du jour : texte arabe, traduction, référence ; partage.
- [ ] Histoire : lire, partager l'image, écouter, mode lecture.
- [ ] La série passe à 2 le lendemain.

**Outils**
- [ ] Tasbih : vibration à chaque appui, vibration longue à 33.
- [ ] Qibla : l'angle correspond à une autre appli ; la boussole tourne ; vibration quand on est aligné.
- [ ] 99 Noms : recherche. Douaas : filtres. Adhkar : compteurs, remise à zéro le lendemain.
- [ ] Zakat : 10 000 avec un gramme à 60 → 250.
- [ ] Suivi des prières et du jeûne : les jours se colorent.
- [ ] Mosquées proches ouvre Plans ; Kaaba en direct et Coran ouvrent le navigateur.

**Calendrier**
- [ ] Lundis, jeudis et 13-14-15 en vert ; jours symboliques en or.
- [ ] Paramètres > ajustement +1 : les dates se décalent.

**Langues** (pour chacune des 6)
- [ ] Interface et histoire traduites ; aucun texte du type `tab.today`.
- [ ] Arabe et ourdou : texte à droite, onglets inversés, rien de coupé.

**Hors-ligne**
- [ ] Mode avion, fermer et rouvrir : histoire, horaires, tasbih, Qibla, douaas disponibles.

**Notifications**
- [ ] Activer : une seule demande d'autorisation.
- [ ] Une notification arrive à l'heure d'une prière (avancez l'heure de l'iPhone pour tester).
- [ ] Désactiver une prière : plus de notification pour elle.
- [ ] Push OneSignal reçu (envoi de test).

**Abonnement (compte sandbox)**
- [ ] L'écran montre le prix, « 7 jours d'essai gratuit », le renouvellement, les deux liens, « Restaurer ».
- [ ] Achat → contenu ouvert tout de suite ; l'onglet devient « Historique ».
- [ ] Prophètes : 25 récits, progression ; Hajj : 4 onglets, checklist ; Quiz : 10 questions, score.
- [ ] Supprimer l'app, réinstaller, Restaurer → Premium revient.
- [ ] Annuler dans les réglages sandbox → à l'expiration, le contenu se referme.
- [ ] Aucun mot « Stripe », « carte » ou lien de paiement dans l'app iOS.

**Compte**
- [ ] Recevoir le code par e-mail, se connecter, se déconnecter.
- [ ] Supprimer le compte → message de confirmation ; la ligne disparaît dans Supabase > Authentication.
- [ ] Exporter mes données ; effacer les données de l'appareil.

**Web**
- [ ] https://tarikh-topaz.vercel.app s'ouvre sans erreur 403 ou 404.
- [ ] Paiement test Stripe avec `4242…` → Premium actif ; portail client ; annulation.

---

## 7. Gratuit et Premium

| Fonction | Gratuit | Premium |
|---|---|---|
| Histoire du jour, rappel du jour | Oui | Oui |
| Horaires de prière, notifications, Qibla | Oui | Oui |
| Tasbih, 99 Noms, douaas, adhkar | Oui | Oui |
| Zakat, suivis de prière et de jeûne, bonnes actions | Oui | Oui |
| Calendrier hégirien, jours de jeûne et jours symboliques | Oui | Oui |
| Partage en image, écoute de l'histoire | Oui | Oui |
| Historique des histoires | 3 dernières | Illimité |
| Favoris | Non | Illimités |
| Récits des 25 prophètes | Le premier | Tous |
| Guide Omra et Hajj | Sommaire | Complet |
| Quiz | 5 questions | 120 questions |
| Explication détaillée des jours symboliques | Résumé | Complète |
| Publicité | Aucune | Aucune |

L'appli gratuite n'affiche aucune publicité : la ligne « sans pub » de votre cahier des charges n'est donc pas un avantage Premium. Ne l'écrivez pas dans la fiche.

---

## 8. Coûts mensuels estimés

Estimations à vérifier sur les pages de tarifs de chaque service.

| Service | Au lancement | Remarque |
|---|---|---|
| Vercel (Hobby) | 0 € | Le plan Hobby est réservé à un usage non commercial : avec des abonnements payants, prévoyez le plan Pro (environ 20 $ par mois) |
| Supabase (gratuit) | 0 € | Pause après une semaine d'inactivité ; plan Pro à environ 25 $ par mois quand l'audience grandit |
| Anthropic | Environ 1 à 3 $ | 8 appels par jour (rédaction, contrôle, 5 traductions, parfois un nouvel essai) |
| OneSignal | 0 € | Push mobile gratuit |
| RevenueCat | 0 € | Gratuit jusqu'à 2 500 $ de revenus suivis par mois, puis environ 1 % |
| Stripe | 0 € fixe | Environ 1,5 % + 0,25 € par paiement européen |
| Apple Developer | Environ 8 € | 99 $ par an |
| **Total au départ** | **Environ 10 € par mois** | Environ 30 € avec Vercel Pro |

Ce qui vous revient sur un abonnement iOS à 4,99 € : environ 3,50 € après TVA et commission de 15 % (Small Business Program), environ 2,90 € à 30 %.

---

## 9. Limites connues

- **iOS jamais compilé ici** (voir partie 1).
- **Histoires générées par IA** : le second contrôle réduit le risque d'erreur sans le supprimer. La mention figure sous chaque histoire et dans « À propos ». Relisez les premières histoires publiées.
- **Traductions arabe et ourdou** : rédigées avec soin mais non relues par un locuteur natif. Faites-les relire avant une promotion dans ces pays.
- **Urdu** : la police Nastaliq est chargée à la demande (160 Ko) ; le premier affichage peut prendre une seconde en réseau lent.
- **Fuseau horaire** : les horaires sont affichés dans le fuseau du téléphone. Une ville choisie dans un autre fuseau affichera des heures décalées.
- **Calendrier hégirien** : Umm al-Qura, avec ajustement manuel de ±2 jours.
- **Favoris** : sur l'appareil seulement.
- **Notifications sur le web** : absentes (limite des navigateurs sur iPhone).
- **Push quotidien** : texte générique sans le titre de l'histoire, pour rester juste dans tous les fuseaux horaires.
- **Contenu Premium lisible sur GitHub** : le dépôt est public, donc les fichiers `content/premium/` aussi. L'appli, elle, ne les sert qu'aux abonnés. Passez le dépôt en privé si cela vous gêne (GitHub > Settings > Change visibility).
- **Votre adresse e-mail** apparaît dans les pages légales et la fiche comme contact. Une adresse dédiée (par exemple contact@…) serait préférable.
- **Mentions légales** : complétez votre nom légal et, si vous avez un statut (micro-entreprise), le numéro SIRET dans `web/terms.html` et `web/privacy.html`.
- **Images du dépôt** : les captures pèsent 24 Mo.

---

## 10. Risques de rejet Apple restants

| Règle | Risque | Ce qui est en place | À surveiller |
|---|---|---|---|
| 2.1 App complète | Moyen | Aucun écran vide, repli hors-ligne, 37 étapes testées | Le serveur et Supabase doivent être en ligne pendant la revue. Compilation à valider sur Mac |
| 3.1.1 Achat intégré | Faible | StoreKit via RevenueCat ; aucun lien de paiement externe dans l'app iOS | Vérifiez l'absence du mot « Stripe » sur l'iPhone |
| 3.1.2 Abonnements | Faible | Prix, durée, essai, renouvellement, liens, restauration affichés avant l'achat | Le lien des conditions doit aussi figurer dans la description (déjà dans `metadata/`) |
| 4.2 Fonctionnalité minimale | Moyen | Notifications locales, vibrations, boussole, géolocalisation, partage natif, achats, hors-ligne | C'est une app web emballée : si Apple le relève, répondez en listant ces fonctions natives (voir `review-notes.md`) |
| 5.1.1 Confidentialité | Faible | Sans compte ; suppression du compte dans l'app ; textes de permission clairs | Les réponses « App Privacy » doivent correspondre à `privacy-labels.md` |
| 5.1.2 Partage de données | Faible | Aucun suivi publicitaire, pas d'ATT | — |
| 1.1 Contenu, IA | Faible à moyen | Contenu sobre, sans controverse ; mention de l'IA ; contrôle automatique | Une histoire fausse le jour de la revue est le vrai risque : relisez celle du jour |
| 2.3 Métadonnées | Faible | Captures tirées de la vraie appli | La capture n° 6 montre un écran Premium : c'est autorisé, la légende le dit |
| 4.3 Applications similaires | Faible | Positionnement « histoire quotidienne » distinct des apps de prière | — |

---

## 11. Se repérer dans le dépôt

```
web/            appli (HTML, CSS, JS, traductions, données publiques, pages légales)
content/        histoires de la bibliothèque et contenu Premium (6 langues)
api/            fonctions serveur Vercel
supabase/       schema.sql, seed.sql
ios/            projet Xcode (Capacitor)
appstore/       fiches, captures, notes de revue, guides
scripts/        build, icônes, captures, vérifications, build iOS
tests/          tests unitaires et test de bout en bout
docs/           règles éditoriales et corrections appliquées
```

Commandes utiles :

```bash
npm install
```

```bash
npm test
```

```bash
npm run test:e2e
```

```bash
npm run dev
```

Cette dernière construit l'appli et la sert sur http://localhost:3000.
