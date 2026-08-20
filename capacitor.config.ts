import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.businessmarket.app',
  appName: 'Business Market',
  webDir: 'dist',
  plugins: {
    CapacitorUpdater: {
      autoUpdate: true,
      resetWhenUpdate: false,
    }
  }
};

export default config;

