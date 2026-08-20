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
      serverClientId: '1055399969589-d9chat8ol17gdt9ljqpastmo69pi7f2q.apps.googleusercontent.com',
      forceCodeForRefreshToken: true,
    }
  }
};

export default config;

