# Abonnement Apple + RevenueCat — mise en place pas à pas

Objectif : un abonnement mensuel `tarikh_premium_monthly` à 4,99 €, avec 7 jours d'essai gratuit, géré par RevenueCat, qui prévient notre serveur.

## A. App Store Connect — créer l'abonnement

1. https://appstoreconnect.apple.com > **Apps** > Tarikh.
2. Menu de gauche : **Monétisation > Abonnements**.
3. « Groupes d'abonnements » > **Créer**. Nom de référence : `Tarikh Premium`.
4. Dans le groupe > **Créer un abonnement**.
   - Nom de référence : `Tarikh Premium mensuel`
   - Identifiant du produit : `tarikh_premium_monthly` (exactement, sans majuscule ; il ne pourra plus être modifié)
5. **Durée de l'abonnement :** 1 mois.
6. **Prix de l'abonnement** > Ajouter un prix > pays de référence France > **4,99 €** > Suivant > Confirmer (Apple calcule les prix des autres pays).
7. **Localisation de l'App Store** > ajoutez chaque langue (français, anglais, arabe, espagnol, indonésien, ourdou si proposé) :
   - Nom affiché : `Tarikh Premium`
   - Description (français) : `Prophètes, guide Hajj, quiz, historique illimité`
   - Description (anglais) : `Prophets, Hajj guide, quiz, unlimited archive`
8. Localisation du **groupe** (page du groupe > Localisation) : nom `Tarikh Premium`, nom de l'app `Tarikh`.
9. **Offre de lancement (essai gratuit)** : dans l'abonnement > « Prix de l'abonnement » > **+** > « Créer une offre de lancement » > tous les pays > date de début aujourd'hui, pas de date de fin > Type : **Gratuit** > Durée : **1 semaine** > Confirmer.
10. **Informations de vérification** : capture d'écran de l'écran d'abonnement (utilisez `screenshots/fr/6.9/06.png` ou faites une capture de l'onglet Premium sur le simulateur) + note : `Unlocks the Prophets stories, the Umrah & Hajj guide, the quiz, the full archive and favourites.`
11. L'état doit passer à **« Prêt à soumettre »**.
12. Sur la page de la version de l'app (« Préparer la soumission »), section **Achats intégrés et abonnements** > sélectionnez `tarikh_premium_monthly`. Le premier abonnement doit être soumis **avec** une version de l'app.

Deux prérequis souvent oubliés (sinon les produits restent invisibles dans l'app) :
- **Contrats** > « Apps payantes » : signé, coordonnées bancaires et fiscales remplies, statut « Actif ».
- **Small Business Program** (commission de 15 % au lieu de 30 %) : inscription sur https://developer.apple.com/app-store/small-business-program/.

## B. RevenueCat

1. https://app.revenuecat.com > créez un compte > **Create new project** : `Tarikh`.
2. **Apps & providers** > **+ New** > **App Store**. Nom `Tarikh iOS`, Bundle ID `com.bourchadarayane.tarikh`.
3. **In-app purchase key** (recommandé) : App Store Connect > Utilisateurs et accès > Intégrations > **Achats intégrés** > générer une clé > téléchargez le fichier `.p8` (une seule fois !) > importez-le dans RevenueCat avec l'Issuer ID et le Key ID. Ne mettez jamais ce fichier dans git.
4. **Product catalog > Products** > **+ New** > importez `tarikh_premium_monthly`.
5. **Product catalog > Entitlements** > **+ New** > identifiant : `premium` (exactement) > attachez le produit.
6. **Product catalog > Offerings** > l'offre `default` > **+ New package** > identifiant **$rc_monthly** (Monthly) > attachez le produit > marquez l'offre comme **Current**.
7. **API keys** :
   - clé publique de l'app iOS (commence par `appl_`) → `REVENUECAT_IOS_PUBLIC_KEY` dans `.env.local` (elle est embarquée dans l'app, ce n'est pas un secret) ;
   - **Secret API key** (v1, commence par `sk_`) → `REVENUECAT_SECRET_API_KEY` dans Vercel et `.env.local` (secret).
8. **Integrations > Webhooks** > **+ New** :
   - URL : `https://tarikh-topaz.vercel.app/api/revenuecat-webhook`
   - Authorization header value : une longue chaîne aléatoire que vous inventez (par exemple le résultat de `openssl rand -hex 32`). Mettez la **même** valeur dans Vercel : `REVENUECAT_WEBHOOK_SECRET`.
   - Environnement : Production **et** Sandbox.
   - Bouton **Send test event** : la réponse doit être `200`.
9. **Apple Server Notifications** (recommandé) : RevenueCat > app iOS > copiez l'URL « Apple Server Notification URL » > collez-la dans App Store Connect > app > Informations sur l'app > **Notifications du serveur de l'App Store** (Production et Sandbox).

## C. Tester en sandbox

1. App Store Connect > Utilisateurs et accès > **Sandbox** > Testeurs > créez un testeur (une adresse e-mail jamais utilisée comme identifiant Apple).
2. Sur un iPhone : Réglages > App Store > **Compte Sandbox** > connectez le testeur.
3. Lancez l'app depuis Xcode ou TestFlight > onglet Premium : le prix et « 7 jours d'essai gratuit » doivent s'afficher.
4. Achetez : le contenu Premium s'ouvre. En sandbox, 1 mois dure 5 minutes et l'abonnement se renouvelle au plus 12 fois (6 fois selon les versions).
5. Vérifiez : RevenueCat > Customers (un client apparaît) ; Supabase > Table editor > `subscriptions` (une ligne `source = apple`, `status = trialing` puis `active`).
6. « Restaurer mes achats » : supprimez l'app, réinstallez, onglet Premium > Restaurer.
7. Annulation : Réglages > App Store > Compte Sandbox > Gérer > annulez ; après expiration, la ligne passe à `expired` et le contenu se referme.

## D. Si le prix ne s'affiche pas dans l'app

Dans l'ordre : contrat « Apps payantes » non actif ; produit pas « Prêt à soumettre » ; Bundle ID différent ; capacité « In-App Purchase » absente de la cible Xcode ; offre RevenueCat non « Current » ; clé `REVENUECAT_IOS_PUBLIC_KEY` absente au moment de `npm run build`. Un produit tout juste créé peut mettre quelques heures à être disponible en sandbox.
