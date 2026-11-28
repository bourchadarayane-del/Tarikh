# App Review notes (paste into App Store Connect > App Review Information > Notes)

```
Thank you for reviewing Tarikh.

NO ACCOUNT NEEDED
The whole app works without signing in. An optional email sign-in exists in Settings > Account only to
use the same subscription on several devices; no demo account is required.

WHAT THE APP DOES
- Today tab: story of the day (Islamic history), reminder of the day (hadith with reference), prayer times.
- Free native tools: prayer times computed on device (works offline), local prayer-time notifications,
  Qibla compass (device sensors + haptics), tasbih counter (haptics), Hijri calendar, 99 Names, duas,
  adhkar, zakat calculator, prayer and fasting trackers, share a story as an image (native share sheet).
- Calendar tab: Hijri month with recommended fasting days and special days.
- Premium tab: auto-renewable subscription.

HOW TO TEST THE SUBSCRIPTION (sandbox)
1. Open the "Premium" tab (third tab) or tap "Premium" at the top right.
2. The screen shows the price, the 1-month duration, the 7-day free trial, the auto-renewal terms,
   links to Terms of Use and Privacy Policy, and a "Restore purchases" button.
3. Tap "Start the 7-day free trial" and confirm with a sandbox account.
4. Premium content unlocks at once: Prophets (25 stories), Umrah & Hajj guide, Quiz (120 questions),
   full story archive, favourites, detailed calendar explanations.
5. "Restore purchases" is on the Premium screen and in Settings > Subscription.
Product ID: tarikh_premium_monthly (subscription group "Tarikh Premium").
The iOS app uses In-App Purchase only. It contains no link, button or text pointing to another
payment method.

FREE PREVIEW
Without subscribing you can read the first prophet story and try 5 quiz questions.

LOCATION
Location (When In Use) is used only to compute prayer times and the Qibla direction. It is rounded
and stored on the device; it is never sent to our servers. If you decline, you can search for a city.

AI-GENERATED CONTENT
The daily story is written server-side by an AI model from a fixed editorial brief, then checked by a
second automated fact-checking pass; a story that fails the check is replaced by a story from a
human-reviewed library. Users cannot enter prompts. Hadiths, duas and adhkar are never AI-generated:
they are quoted from recognised collections with their references. The app states this in
Settings > About and under the daily story.

ACCOUNT DELETION
Settings > Account > "Delete my account and data" (visible once signed in) deletes the account and
all server data immediately. Data stored on the device can be erased in Settings > My data.

NOTIFICATIONS
Optional. Local notifications for prayer times are scheduled on device. A daily push announces the
story of the day.

No hidden features, no remote feature flags, no external payment links.
Contact: bourchada.rayane@gmail.com
```

## Coordonnées à saisir dans « App Review Information »

- Prénom, nom, téléphone, e-mail : les vôtres.
- « Sign-in required » : **décoché** (aucun compte nécessaire).

## Avant de soumettre, vérifiez que c'est vrai

- [ ] Le serveur (Vercel) répond et les variables d'environnement sont en place : sinon l'achat sandbox ne débloquera pas le contenu.
- [ ] Supabase est actif (un projet gratuit se met en pause après une semaine sans activité) et `seed.sql` a été exécuté.
- [ ] Le produit `tarikh_premium_monthly` est « Prêt à soumettre » et joint à la version.
