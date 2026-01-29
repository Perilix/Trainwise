import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.trainwise.app',
  appName: 'Trainwise',
  webDir: 'dist/frontend/browser',
  ios: {
    contentInset: 'automatic',
    preferredContentMode: 'mobile',
    scheme: 'App'
  },
  plugins: {
    Keyboard: {
      resize: 'body',
      resizeOnFullScreen: true
    },
    StatusBar: {
      style: 'dark',
      backgroundColor: '#F6F4F0'
    }
  },
  server: {
    // Pour le dev local, décommente cette ligne et mets ton IP
    // url: 'http://192.168.1.X:4200',
    cleartext: true
  }
};

export default config;
