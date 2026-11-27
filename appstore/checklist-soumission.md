# Checklist de soumission — de Xcode à l'App Store

Cochez dans l'ordre. Les étapes de création de comptes sont détaillées dans `REPORT.md` (partie « Ce que je dois faire moi-même »).

## 1. Préparer le Mac (une seule fois)

- [ ] Xcode installé depuis le Mac App Store, ouvert une fois (accepter la licence).
- [ ] Node.js 20 ou plus : `node -v`.
- [ ] CocoaPods : `brew install cocoapods` (ou `sudo gem install cocoapods`).
- [ ] Le dépôt cloné, sur la branche fusionnée, avec `.env.local` rempli.

## 2. Construire

```bash
./scripts/build-ios.sh
```

- [ ] Le build sur simulateur se termine par `BUILD SUCCEEDED`.

```bash
./scripts/build-ios.sh open
```

## 3. Régler la signature dans Xcode

- [ ] Panneau de gauche : projet **App** > cible **App** > onglet **Signing & Capabilities**.
- [ ] Cochez **Automatically manage signing**, choisissez votre **Team**.
- [ ] Bundle Identifier : `com.bourchadarayane.tarikh`.
- [ ] Vérifiez la présence des capacités **Push Notifications** et **In-App Purchase**. S'il en manque une : bouton **+ Capability**.
- [ ] Onglet **General** : Version `1.0.0`, Build `1`, iPhone uniquement, Portrait.

## 4. Tester sur un vrai iPhone

- [ ] Branchez l'iPhone, choisissez-le en haut de Xcode, bouton ▶.
- [ ] Parcourez la checklist de test de `REPORT.md` (au minimum : horaires, Qibla avec boussole, tasbih avec vibration, notification de prière, achat sandbox, restauration, mode avion).

## 5. Archiver et envoyer à TestFlight

- [ ] En haut de Xcode, choisissez la destination **Any iOS Device (arm64)**.
- [ ] Menu **Product > Archive** (5 à 10 minutes).
- [ ] La fenêtre **Organizer** s'ouvre > **Distribute App** > **App Store Connect** > **Upload** > laissez les options par défaut > **Upload**.
- [ ] Attendez l'e-mail d'Apple « build processed » (10 à 30 minutes).
- [ ] App Store Connect > TestFlight > le build apparaît. Répondez à la question sur le chiffrement si elle est posée : **aucun chiffrement non exempté** (déjà déclaré dans Info.plist).
- [ ] TestFlight > **Tests internes** > créez un groupe > ajoutez-vous > installez l'app **TestFlight** sur l'iPhone > testez.

## 6. Remplir la fiche (App Store Connect > Distribution)

- [ ] Captures 6,9 pouces : glissez les 6 fichiers de `screenshots/fr/6.9/` (et ceux de `en/6.9/` dans la localisation anglaise). 6,5 pouces : `screenshots/<langue>/6.5/`.
- [ ] Pour chaque langue : nom, sous-titre, texte promotionnel, description, mots-clés, nouveautés (copier depuis `metadata/<langue>/`).
- [ ] URL d'assistance et de confidentialité, catégories, classification d'âge (`README.md` de ce dossier).
- [ ] **Confidentialité de l'app** (`privacy-labels.md`).
- [ ] **Achats intégrés et abonnements** : sélectionnez `tarikh_premium_monthly` (`iap-setup.md`).
- [ ] **Build** : sélectionnez le build envoyé.
- [ ] **Informations pour la vérification** : collez `review-notes.md`, vos coordonnées, « connexion requise » décoché.
- [ ] Publication : « Publier manuellement cette version » (conseillé pour une première).

## 7. Soumettre

- [ ] Bouton **Ajouter pour vérification** puis **Soumettre à la vérification de l'app**.
- [ ] Délai habituel : 24 à 48 heures. En cas de refus, Apple écrit dans le **Centre de résolution** : lisez le numéro de la règle citée et reportez-vous au tableau « Risques de rejet » de `REPORT.md`.

## 8. Après l'acceptation

- [ ] Publiez la version.
- [ ] Vérifiez un achat réel (vous pouvez vous rembourser via https://reportaproblem.apple.com).
- [ ] Surveillez pendant quelques jours : Vercel > Logs (cron quotidien), Supabase > `daily_stories` (6 lignes par jour), RevenueCat > Overview.
