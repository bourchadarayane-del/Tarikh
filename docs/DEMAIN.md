# Reste à faire — la version courte

État au 28 novembre 2026. Le détail clic par clic est dans `REPORT.md`, partie 5.

## Déjà fait

- Site en ligne : https://tarikh-topaz.vercel.app (accès public, plus d'erreur 403).
- Base Supabase `tarikh` (Francfort) installée, sécurité vérifiée.
- Dans Vercel : `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `PUBLIC_SITE_URL`, `ANTHROPIC_KEY` (nouvelle clé), `ONESIGNAL_REST_API_KEY`, `CRON_SECRET`.

## Pour voir où on en est à tout moment

Ouvrez https://tarikh-topaz.vercel.app/api/health (après avoir fusionné la PR « diagnostic »). La page liste, fonction par fonction, ce qui est prêt et ce qui manque, sans jamais afficher une valeur. Elle signale aussi une clé Supabase qui appartiendrait à l'ancien projet.

## Dans l'ordre

| # | Action | Où | Durée |
|---|---|---|---|
| 1 | Copier la clé **service_role** du projet **tarikh** et la coller dans Vercel sous `SUPABASE_SERVICE_ROLE_KEY` (cocher « Sensitive »). L'ancienne variable `SUPABASE_SERVICE_KEY` vient de l'ancien projet : supprimez-la | Supabase > Project Settings > API ; Vercel > Settings > Environment Variables | 3 min |
| 2 | Modèle d'e-mail « Magic Link » : ajouter `Votre code Tarikh : {{ .Token }}` ; URL Configuration : Site URL `https://tarikh-topaz.vercel.app`, Redirect URLs `https://tarikh-topaz.vercel.app/**` et `capacitor://localhost` | Supabase > Authentication | 3 min |
| 3 | Vérifier le tarif Stripe `price_1TVVJRFay6MULiL0XxuPiabG` : actif, 4,99 € par mois, mode test. Sinon en créer un | Stripe > Catalogue de produits | 3 min |
| 4 | Ajouter dans Vercel : `STRIPE_PRICE_ID`, `STRIPE_SECRET_KEY` (sk_test_…), `STRIPE_WEBHOOK_SECRET` (créer d'abord le webhook : voir REPORT 5-c) | Stripe > Développeurs ; Vercel | 10 min |
| 5 | **Redéployer** : Vercel > Deployments > Redeploy (nécessaire pour que les variables soient prises en compte) | Vercel | 1 min |
| 6 | Lancer le cron une fois : Vercel > Settings > Cron Jobs > Run sur `/api/cron-daily`. Vérifier dans Supabase > Table Editor > `daily_stories` : 12 lignes | Vercel, Supabase | 2 min |
| 7 | Reconnecter GitHub à Vercel (bouton Reconnect) pour que chaque fusion déploie toute seule | Vercel > Settings > Git | 2 min |
| 8 | **S'inscrire à Apple Developer** (99 $ par an, validation 24 à 48 h) | https://developer.apple.com/programs/enroll | 10 min |

## Quand Apple a validé le compte

1. Identifiant d'app, clé APNs `.p8`, contrat « Apps payantes » : `REPORT.md` 5-e et 5-g.
2. RevenueCat, abonnement et essai de 7 jours : `appstore/iap-setup.md`. RevenueCat est gratuit jusqu'à environ 2 500 $ de revenus par mois.
3. Sur le Mac : `./scripts/build-ios.sh`, Archive, TestFlight : `appstore/checklist-soumission.md`.
4. Fiche App Store, captures, confidentialité : dossier `appstore/`.

## À décider

- **Plan Vercel Pro** (environ 20 $ par mois) avant le premier abonnement payant : le plan Hobby est non commercial.
- **Dépôt GitHub public** : le contenu Premium y est lisible. Passez-le en privé si cela vous gêne.
- **Sécurité** : vous avez photographié des clés (Anthropic, OneSignal). Quand tout fonctionne, supprimez-les dans leurs consoles et recréez-les, puis collez-les directement dans Vercel.
