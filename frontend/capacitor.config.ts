import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.trainwise.appli',
  appName: 'Trainwise',
  webDir: 'dist/frontend/browser',
  ios: {
    preferredContentMode: 'mobile',
    scheme: 'App',
    backgroundColor: '#003554'
  },
  plugins: {
    Keyboard: {
      resize: 'body',
      resizeOnFullScreen: true
    },
    StatusBar: {
      style: 'light',
      overlaysWebView: true,
      backgroundColor: '#003554'
    }
  },
  // DEV ONLY — décommenter pour le live reload local (remplace l'IP par celle de ton Mac : ipconfig getifaddr en0)
  // server: {
  //   url: 'http://192.168.1.11:4200',
  //   cleartext: true
  // }
};

export default config;
