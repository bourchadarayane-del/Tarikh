# Dossier de soumission App Store — Tarikh

Tout ce qu'il faut copier dans App Store Connect se trouve ici.

| Dossier / fichier | Contenu |
|---|---|
| `metadata/<langue>/` | Nom, sous-titre, texte promotionnel, description, mots-clés, nouveautés (fr, en, ar, es, id, ur) |
| `screenshots/<langue>/6.9/` et `6.5/` | 6 captures par taille, dans les 6 langues (JPEG) (générées par `npm run screenshots`) |
| `icon/AppIcon-1024.png` | Icône 1024 × 1024 sans transparence (déjà copiée dans le projet Xcode) |
| `review-notes.md` | Notes pour les relecteurs Apple (à coller dans « App Review Information > Notes ») |
| `privacy-labels.md` | Réponses exactes au questionnaire « App Privacy » |
| `iap-setup.md` | Création de l'abonnement, de l'essai de 7 jours, de RevenueCat et du webhook |
| `checklist-soumission.md` | De l'archive Xcode à la soumission, étape par étape |

## Réglages généraux de la fiche

- **Bundle ID :** `com.bourchadarayane.tarikh`
- **SKU :** `tarikh-ios-001`
- **Langue principale :** Français
- **Catégorie principale : Références.** Tarikh est d'abord un ouvrage de consultation quotidien (histoire, hadiths, douaas, calendrier, horaires). La catégorie Éducation est très encombrée et suppose un parcours d'apprentissage ; Références correspond mieux à l'usage et la concurrence y est plus faible sur les mots-clés visés.
- **Catégorie secondaire : Style de vie.**
- **Prix :** gratuit, avec achats intégrés.
- **Disponibilité :** tous les pays.
- **URL d'assistance :** https://tarikh-topaz.vercel.app/support
- **URL de la politique de confidentialité :** https://tarikh-topaz.vercel.app/privacy
- **URL marketing (facultatif) :** https://tarikh-topaz.vercel.app/
- **Conditions d'utilisation (EULA) :** laissez le contrat standard d'Apple ; le lien vers nos conditions figure dans la description et dans l'écran d'abonnement.
- **Copyright :** `2026 Rayane Bourchada` (adaptez à votre nom légal).

## Classification d'âge (questionnaire)

Répondez **« Aucun »** à toutes les questions de contenu (violence, contenu sexuel, grossièretés, alcool/drogues, jeux d'argent, horreur, contenu médical).

| Question | Réponse |
|---|---|
| Accès Web non restreint | Non |
| Contenu généré par les utilisateurs | Non |
| Messagerie / discussion | Non |
| Publicité | Non |
| Jeux d'argent, concours | Non |
| Thèmes religieux | Si la question est posée : contenu religieux éducatif, peu fréquent/modéré |
| Fonctionnalités d'IA générative | Si la question est posée : le contenu quotidien est généré par IA côté serveur, relu automatiquement ; l'utilisateur ne peut pas saisir de requête |

Résultat attendu : **4+**.
