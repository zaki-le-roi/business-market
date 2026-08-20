import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.businessmarket.app',
  appName: 'Business Market',
  webDir: 'dist',
  server: {
    url: 'https://business-market-olt.pages.dev',
    cleartext: false,
  },
  plugins: {
    CapacitorUpdater: {
      autoUpdate: true,
      resetWhenUpdate: false,
    },
    GoogleAuth: {
      scopes: ['profile', 'email'],
      serverClientId: 'https://business-market-olt.pages.dev',
      forceCodeForRefreshToken: true,
    }
  }
};

export default config;

