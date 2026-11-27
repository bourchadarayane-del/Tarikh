import type { CapacitorConfig } from '@capacitor/cli';

// Identifiant de l'application (Bundle ID). Pour le changer : modifiez-le ici ET dans Xcode
// (cible App > Signing & Capabilities), puis créez le même identifiant sur developer.apple.com.
const config: CapacitorConfig = {
  appId: 'com.bourchadarayane.tarikh',
  appName: 'Tarikh',
  webDir: 'www',
  backgroundColor: '#080400',
  ios: {
    contentInset: 'never',
    backgroundColor: '#080400',
    preferredContentMode: 'mobile',
    allowsLinkPreview: false,
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: false,
      backgroundColor: '#080400',
      showSpinner: false,
      launchFadeOutDuration: 250,
    },
    LocalNotifications: {
      iconColor: '#C9A84C',
    },
  },
};

export default config;
