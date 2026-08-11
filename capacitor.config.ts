import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'dz.businessmarket.app',
  appName: 'Business Market',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  }
};

export default config;
