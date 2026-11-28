#!/usr/bin/env bash
# Construit l'application iOS sur un Mac (Xcode + CocoaPods requis).
#   ./scripts/build-ios.sh            -> build de vérification sur simulateur
#   ./scripts/build-ios.sh open       -> ouvre le projet dans Xcode (pour Archive / TestFlight)
set -euo pipefail
cd "$(dirname "$0")/.."

command -v xcodebuild >/dev/null || { echo "Xcode est introuvable. Installez Xcode depuis le Mac App Store, puis : sudo xcode-select -s /Applications/Xcode.app"; exit 1; }
command -v pod >/dev/null || { echo "CocoaPods est introuvable. Installez-le avec : brew install cocoapods"; exit 1; }
[ -f .env.local ] || echo "Attention : .env.local absent (SUPABASE_URL, SUPABASE_ANON_KEY, REVENUECAT_IOS_PUBLIC_KEY…). L'appli fonctionnera avec les contenus embarqués seulement."

npm install
npm run build                 # web/ -> www/ (lit .env.local pour la configuration publique)
node scripts/configure-ios.mjs
npx cap sync ios              # copie www/ dans le projet et lance pod install

if [ "${1:-}" = "open" ]; then npx cap open ios; exit 0; fi

# Choisit le premier simulateur iPhone disponible.
DEVICE=$(xcrun simctl list devices available | grep -m1 -o 'iPhone [^(]*' | sed 's/ *$//')
echo "Build sur le simulateur : ${DEVICE:-iPhone 16}"
xcodebuild -workspace ios/App/App.xcworkspace -scheme App -configuration Debug \
  -destination "platform=iOS Simulator,name=${DEVICE:-iPhone 16}" CODE_SIGNING_ALLOWED=NO build | tail -n 25
echo "Build terminé. Pour lancer l'appli : npx cap run ios"
