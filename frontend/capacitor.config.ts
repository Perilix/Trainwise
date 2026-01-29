import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.trainwise.app',
  appName: 'Trainwise',
  webDir: 'dist/frontend/browser',
  ios: {
    contentInset: 'automatic',
    preferredContentMode: 'mobile',
    scheme: 'App',
    backgroundColor: '#F6F4F0'
  },
  plugins: {
    Keyboard: {
      resize: 'body',
      resizeOnFullScreen: true
    },
    StatusBar: {
      style: 'light',
      backgroundColor: '#003554',
      overlaysWebView: true
    }
  },
  server: {
    // Live reload depuis ton Mac
    url: 'http://192.168.1.31:4200',
    cleartext: true
  }
};

export default config;
