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
  // Live reload en dev
  server: {
    url: 'http://localhost:4200',
    cleartext: true
  }
};

export default config;
