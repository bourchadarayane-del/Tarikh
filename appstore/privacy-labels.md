# App Privacy — réponses exactes pour App Store Connect

App Store Connect > votre app > **Confidentialité de l'app** > « Commencer ».

## 1. « Collectez-vous des données à partir de cette app ? » → **Oui**

## 2. Types de données à cocher

| Catégorie | Type | Cocher ? | Pourquoi |
|---|---|---|---|
| Coordonnées | **Adresse e-mail** | Oui | Compte facultatif (connexion par e-mail) |
| Achats | **Historique d'achat** | Oui | Abonnement géré par RevenueCat et notre serveur |
| Identifiants | **Identifiant de l'appareil** | Oui | Jeton de notification (OneSignal) et identifiant anonyme d'abonnement |
| Localisation | **Localisation approximative** | Oui (par prudence) | Utilisée pour les horaires de prière et la Qibla. Elle reste sur l'appareil ; nous la déclarons quand même pour être transparents |
| Localisation | Localisation précise | **Non** | La position est arrondie à environ 1 km |
| Toutes les autres | — | **Non** | Pas de nom, pas de contacts, pas de photos, pas de données de santé, pas de données d'utilisation, pas de diagnostics envoyés par nous |

## 3. Pour CHAQUE type coché, répondez ainsi

| Type | Finalité | Liée à l'identité de l'utilisateur ? | Utilisée pour le suivi ? |
|---|---|---|---|
| Adresse e-mail | Fonctionnalité de l'app | **Oui** | Non |
| Historique d'achat | Fonctionnalité de l'app | **Non** | Non |
| Identifiant de l'appareil | Fonctionnalité de l'app | **Non** | Non |
| Localisation approximative | Fonctionnalité de l'app | **Non** | Non |

Ne cochez **aucune** autre finalité (ni Publicité, ni Analyse, ni Personnalisation, ni Marketing).

## 4. Suivi (tracking)

- « Utilisez-vous des données à des fins de suivi ? » → **Non**.
- Conséquence : pas de fenêtre « Autoriser le suivi » (ATT) dans l'app, et `NSPrivacyTracking` vaut `false` dans `ios/App/App/PrivacyInfo.xcprivacy`.

## 5. Cohérence à garder

Ces réponses correspondent au fichier `PrivacyInfo.xcprivacy` du projet et à la page https://tarikh-topaz.vercel.app/privacy. Si vous ajoutez un jour un outil de statistiques ou de publicité, il faudra mettre à jour les trois.

> Note : si vous préférez la lecture stricte de la définition d'Apple (« collecter » = envoyer hors de l'appareil), vous pouvez ne pas déclarer la localisation, puisqu'elle ne quitte jamais le téléphone. Dans ce cas, retirez aussi le bloc `NSPrivacyCollectedDataTypeCoarseLocation` de `scripts/configure-ios.mjs` et relancez-le. La déclaration prudente proposée ici ne pose aucun problème en revue.
