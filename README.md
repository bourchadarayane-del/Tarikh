# Tarikh – Histoire Islamique

Application quotidienne d'histoire islamique : une histoire vraie et un hadith authentique chaque jour, plus des outils pratiques (horaires de prière, Qibla, tasbih, calendrier hégirien, douaas, adhkar, zakat). Six langues : français, anglais, arabe, espagnol, indonésien, ourdou.

Une seule base web (`web/`) sert à la fois le site (Vercel) et l'application iOS (Capacitor, dossier `ios/`).

**Commencez par lire [`REPORT.md`](REPORT.md)** : ce qui est fait, ce qu'il reste à brancher, étape par étape.

## Démarrer

```bash
npm install
```

```bash
npm run dev
```

L'appli s'ouvre sur http://localhost:3000. Sans fichier `.env.local`, elle fonctionne avec les contenus embarqués.

## Vérifier

```bash
npm test
```

```bash
npm run test:e2e
```

## iOS (sur un Mac)

```bash
./scripts/build-ios.sh
```

## Dossiers

| Dossier | Contenu |
|---|---|
| `web/` | Appli : HTML, CSS, JavaScript, traductions, données publiques, pages légales |
| `content/` | Histoires de la bibliothèque et contenu Premium |
| `api/` | Fonctions serveur (abonnements, webhooks, cron quotidien) |
| `supabase/` | Schéma et données initiales de la base |
| `ios/` | Projet Xcode |
| `appstore/` | Dossier de soumission App Store |
| `scripts/`, `tests/` | Outils et tests |

Les secrets ne vont jamais dans git : voir `.env.example`.
