// Configure le projet Xcode généré par Capacitor (idempotent : peut être relancé après `npx cap add ios`).
// - Info.plist : permissions expliquées, portrait, pas de chiffrement non exempté, langues, push en arrière-plan
// - PrivacyInfo.xcprivacy, App.entitlements (Push), noms et textes localisés (InfoPlist.strings)
// - project.pbxproj : fichiers ajoutés aux ressources, iPhone uniquement, version 1.0.0 (build 1)
// Usage : node scripts/configure-ios.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const app = path.join(root, 'ios/App/App');
if (!fs.existsSync(app)) { console.error('Projet iOS absent : lancez d\'abord `npx cap add ios --packagemanager CocoaPods`.'); process.exit(1); }

// ---------- Textes localisés ----------
const L = {
  fr: { name: 'Tarikh', loc: 'Votre position sert uniquement à calculer les horaires de prière et la direction de la Qibla. Elle reste sur votre appareil.', motion: 'Les capteurs de mouvement servent à orienter la boussole de la Qibla.' },
  en: { name: 'Tarikh', loc: 'Your location is only used to compute prayer times and the Qibla direction. It stays on your device.', motion: 'Motion sensors are used to orient the Qibla compass.' },
  ar: { name: 'تاريخ', loc: 'يُستخدم موقعك فقط لحساب مواقيت الصلاة واتجاه القبلة، ويبقى على جهازك.', motion: 'تُستخدم مستشعرات الحركة لتوجيه بوصلة القبلة.' },
  es: { name: 'Tarikh', loc: 'Tu ubicación solo se usa para calcular los horarios de oración y la dirección de la Qibla. Permanece en tu dispositivo.', motion: 'Los sensores de movimiento se usan para orientar la brújula de la Qibla.' },
  id: { name: 'Tarikh', loc: 'Lokasi Anda hanya digunakan untuk menghitung waktu salat dan arah kiblat. Lokasi tetap tersimpan di perangkat Anda.', motion: 'Sensor gerak digunakan untuk mengarahkan kompas kiblat.' },
  ur: { name: 'تاریخ', loc: 'آپ کا مقام صرف نماز کے اوقات اور قبلہ کی سمت معلوم کرنے کے لیے استعمال ہوتا ہے اور آپ کے آلے پر ہی رہتا ہے۔', motion: 'حرکت کے سینسر قبلہ نما کی سمت درست کرنے کے لیے استعمال ہوتے ہیں۔' },
};
const esc = (s) => s.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
for (const [lang, t] of Object.entries(L)) {
  const dir = path.join(app, `${lang}.lproj`);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'InfoPlist.strings'),
    `/* Tarikh — ${lang} */\n"CFBundleDisplayName" = "${esc(t.name)}";\n"NSLocationWhenInUseUsageDescription" = "${esc(t.loc)}";\n"NSMotionUsageDescription" = "${esc(t.motion)}";\n`);
}

// ---------- Info.plist ----------
const plistPath = path.join(app, 'Info.plist');
let plist = fs.readFileSync(plistPath, 'utf8');
function setKey(key, valueXml) {
  const re = new RegExp(`\\s*<key>${key}</key>\\s*(<(string|array|dict)>[\\s\\S]*?</\\2>|<true/>|<false/>)`);
  plist = plist.replace(re, '');
  const end = plist.lastIndexOf('</dict>');
  plist = `${plist.slice(0, end).replace(/\s*$/, '')}\n\t<key>${key}</key>\n\t${valueXml}\n${plist.slice(end)}`;
}
const arr = (items) => `<array>\n${items.map((i) => `\t\t<string>${i}</string>`).join('\n')}\n\t</array>`;
setKey('CFBundleDevelopmentRegion', '<string>fr</string>');
setKey('CFBundleLocalizations', arr(Object.keys(L)));
setKey('NSLocationWhenInUseUsageDescription', `<string>${L.fr.loc} / ${L.en.loc}</string>`);
setKey('NSMotionUsageDescription', `<string>${L.fr.motion} / ${L.en.motion}</string>`);
setKey('ITSAppUsesNonExemptEncryption', '<false/>');
setKey('UIBackgroundModes', arr(['remote-notification']));
setKey('UIRequiredDeviceCapabilities', arr(['arm64']));
setKey('UISupportedInterfaceOrientations', arr(['UIInterfaceOrientationPortrait']));
setKey('UISupportedInterfaceOrientations~ipad', arr(['UIInterfaceOrientationPortrait', 'UIInterfaceOrientationPortraitUpsideDown']));
setKey('UIStatusBarStyle', '<string>UIStatusBarStyleLightContent</string>');
setKey('UIRequiresFullScreen', '<true/>');
fs.writeFileSync(plistPath, plist);

// ---------- Manifeste de confidentialité ----------
fs.writeFileSync(path.join(app, 'PrivacyInfo.xcprivacy'), `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<!-- Aucun suivi publicitaire : pas de fenêtre ATT. -->
	<key>NSPrivacyTracking</key>
	<false/>
	<key>NSPrivacyTrackingDomains</key>
	<array/>
	<key>NSPrivacyCollectedDataTypes</key>
	<array>
		<!-- Historique d'achat (abonnement, via RevenueCat) -->
		<dict>
			<key>NSPrivacyCollectedDataType</key>
			<string>NSPrivacyCollectedDataTypePurchaseHistory</string>
			<key>NSPrivacyCollectedDataTypeLinked</key>
			<false/>
			<key>NSPrivacyCollectedDataTypeTracking</key>
			<false/>
			<key>NSPrivacyCollectedDataTypePurposes</key>
			<array>
				<string>NSPrivacyCollectedDataTypePurposeAppFunctionality</string>
			</array>
		</dict>
		<!-- Identifiant d'appareil (jeton de notification OneSignal, identifiant anonyme d'abonnement) -->
		<dict>
			<key>NSPrivacyCollectedDataType</key>
			<string>NSPrivacyCollectedDataTypeDeviceID</string>
			<key>NSPrivacyCollectedDataTypeLinked</key>
			<false/>
			<key>NSPrivacyCollectedDataTypeTracking</key>
			<false/>
			<key>NSPrivacyCollectedDataTypePurposes</key>
			<array>
				<string>NSPrivacyCollectedDataTypePurposeAppFunctionality</string>
			</array>
		</dict>
		<!-- Adresse e-mail (uniquement si l'utilisateur crée un compte, facultatif) -->
		<dict>
			<key>NSPrivacyCollectedDataType</key>
			<string>NSPrivacyCollectedDataTypeEmailAddress</string>
			<key>NSPrivacyCollectedDataTypeLinked</key>
			<true/>
			<key>NSPrivacyCollectedDataTypeTracking</key>
			<false/>
			<key>NSPrivacyCollectedDataTypePurposes</key>
			<array>
				<string>NSPrivacyCollectedDataTypePurposeAppFunctionality</string>
			</array>
		</dict>
		<!-- Localisation approximative : déclarée par prudence (elle est traitée sur l'appareil pour les horaires et la Qibla) -->
		<dict>
			<key>NSPrivacyCollectedDataType</key>
			<string>NSPrivacyCollectedDataTypeCoarseLocation</string>
			<key>NSPrivacyCollectedDataTypeLinked</key>
			<false/>
			<key>NSPrivacyCollectedDataTypeTracking</key>
			<false/>
			<key>NSPrivacyCollectedDataTypePurposes</key>
			<array>
				<string>NSPrivacyCollectedDataTypePurposeAppFunctionality</string>
			</array>
		</dict>
	</array>
	<key>NSPrivacyAccessedAPITypes</key>
	<array>
		<!-- Réglages et compteurs stockés sur l'appareil -->
		<dict>
			<key>NSPrivacyAccessedAPIType</key>
			<string>NSPrivacyAccessedAPICategoryUserDefaults</string>
			<key>NSPrivacyAccessedAPITypeReasons</key>
			<array>
				<string>CA92.1</string>
			</array>
		</dict>
		<!-- Fichier temporaire de l'image partagée -->
		<dict>
			<key>NSPrivacyAccessedAPIType</key>
			<string>NSPrivacyAccessedAPICategoryFileTimestamp</string>
			<key>NSPrivacyAccessedAPITypeReasons</key>
			<array>
				<string>C617.1</string>
			</array>
		</dict>
	</array>
</dict>
</plist>
`);

// ---------- Entitlements (notifications push) ----------
// « development » est remplacé automatiquement par « production » lors de l'archive pour l'App Store.
fs.writeFileSync(path.join(app, 'App.entitlements'), `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>aps-environment</key>
	<string>development</string>
</dict>
</plist>
`);

// ---------- project.pbxproj ----------
const pbxPath = path.join(root, 'ios/App/App.xcodeproj/project.pbxproj');
let pbx = fs.readFileSync(pbxPath, 'utf8');
const ID = { privacyRef: '7A51C0DE00000000000000A1', privacyBuild: '7A51C0DE00000000000000A2', entRef: '7A51C0DE00000000000000A3', variant: '7A51C0DE00000000000000A4', variantBuild: '7A51C0DE00000000000000A5' };
const langId = (i) => `7A51C0DE00000000000000B${i}`;
const langs = Object.keys(L);

if (!pbx.includes(ID.privacyRef)) {
  const insertAfter = (marker, text) => { const i = pbx.indexOf(marker); if (i < 0) throw new Error(`Repère introuvable : ${marker}`); pbx = pbx.slice(0, i + marker.length) + text + pbx.slice(i + marker.length); };
  insertAfter('/* Begin PBXBuildFile section */\n',
    `\t\t${ID.privacyBuild} /* PrivacyInfo.xcprivacy in Resources */ = {isa = PBXBuildFile; fileRef = ${ID.privacyRef} /* PrivacyInfo.xcprivacy */; };\n` +
    `\t\t${ID.variantBuild} /* InfoPlist.strings in Resources */ = {isa = PBXBuildFile; fileRef = ${ID.variant} /* InfoPlist.strings */; };\n`);
  insertAfter('/* Begin PBXFileReference section */\n',
    `\t\t${ID.privacyRef} /* PrivacyInfo.xcprivacy */ = {isa = PBXFileReference; lastKnownFileType = text.xml; path = PrivacyInfo.xcprivacy; sourceTree = "<group>"; };\n` +
    `\t\t${ID.entRef} /* App.entitlements */ = {isa = PBXFileReference; lastKnownFileType = text.plist.entitlements; path = App.entitlements; sourceTree = "<group>"; };\n` +
    langs.map((l, i) => `\t\t${langId(i)} /* ${l} */ = {isa = PBXFileReference; lastKnownFileType = text.plist.strings; name = ${l}; path = ${l}.lproj/InfoPlist.strings; sourceTree = "<group>"; };\n`).join(''));
  insertAfter('/* Begin PBXVariantGroup section */\n',
    `\t\t${ID.variant} /* InfoPlist.strings */ = {\n\t\t\tisa = PBXVariantGroup;\n\t\t\tchildren = (\n${langs.map((l, i) => `\t\t\t\t${langId(i)} /* ${l} */,\n`).join('')}\t\t\t);\n\t\t\tname = InfoPlist.strings;\n\t\t\tsourceTree = "<group>";\n\t\t};\n`);
  // Groupe « App » (celui qui contient Info.plist) et phase « Resources ».
  const groupMatch = /(children = \(\n(?:[^)]*\n)*?[^)]*\/\* Info\.plist \*\/,\n)/.exec(pbx);
  if (!groupMatch) throw new Error('Groupe App introuvable');
  pbx = pbx.replace(groupMatch[1], `${groupMatch[1]}\t\t\t\t${ID.privacyRef} /* PrivacyInfo.xcprivacy */,\n\t\t\t\t${ID.entRef} /* App.entitlements */,\n\t\t\t\t${ID.variant} /* InfoPlist.strings */,\n`);
  const resMatch = /(isa = PBXResourcesBuildPhase;\n\s*buildActionMask = \d+;\n\s*files = \(\n)/.exec(pbx);
  if (!resMatch) throw new Error('Phase Resources introuvable');
  pbx = pbx.replace(resMatch[1], `${resMatch[1]}\t\t\t\t${ID.privacyBuild} /* PrivacyInfo.xcprivacy in Resources */,\n\t\t\t\t${ID.variantBuild} /* InfoPlist.strings in Resources */,\n`);
}
// Langues connues du projet.
pbx = pbx.replace(/knownRegions = \(([\s\S]*?)\);/, (m, body) => {
  const have = body.split(',').map((s) => s.trim().replace(/"/g, '')).filter(Boolean);
  const all = [...new Set([...have, ...langs])];
  return `knownRegions = (\n${all.map((r) => `\t\t\t\t${r},\n`).join('')}\t\t\t);`;
});
pbx = pbx.replace(/developmentRegion = \w+;/, 'developmentRegion = fr;');
// Réglages de la cible App : version, iPhone uniquement, entitlements.
pbx = pbx.replace(/MARKETING_VERSION = [^;]+;/g, 'MARKETING_VERSION = 1.0.0;');
pbx = pbx.replace(/CURRENT_PROJECT_VERSION = [^;]+;/g, 'CURRENT_PROJECT_VERSION = 1;');
pbx = pbx.replace(/TARGETED_DEVICE_FAMILY = "[^"]+";/g, 'TARGETED_DEVICE_FAMILY = 1;');
if (!pbx.includes('CODE_SIGN_ENTITLEMENTS')) pbx = pbx.replace(/(\t+)CODE_SIGN_STYLE = Automatic;/g, '$1CODE_SIGN_ENTITLEMENTS = App/App.entitlements;\n$1CODE_SIGN_STYLE = Automatic;');
fs.writeFileSync(pbxPath, pbx);

// Contrôle : le fichier projet doit rester lisible par l'analyseur utilisé par Cordova/Capacitor.
try {
  const { createRequire } = await import('node:module');
  const xcode = createRequire(import.meta.url)('xcode');
  const proj = xcode.project(pbxPath).parseSync();
  const res = Object.values(proj.hash.project.objects.PBXResourcesBuildPhase).find((v) => v && v.files);
  const names = res.files.map((f) => f.comment);
  for (const n of ['PrivacyInfo.xcprivacy in Resources', 'InfoPlist.strings in Resources']) if (!names.includes(n)) throw new Error(`absent des ressources : ${n}`);
  console.log(`project.pbxproj valide (${names.length} ressources).`);
} catch (err) { console.error('ATTENTION : vérification du projet Xcode échouée :', err.message); process.exit(1); }
console.log('Projet iOS configuré : Info.plist, PrivacyInfo.xcprivacy, App.entitlements, InfoPlist.strings (6 langues).');
