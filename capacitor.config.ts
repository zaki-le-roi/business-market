import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.businessmarket.app',
  appName: 'Business Market',
  webDir: 'dist',
  server: {
    url: 'https://business-market.pages.dev',
    cleartext: true
  }
};

export default config;
