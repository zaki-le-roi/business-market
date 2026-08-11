import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  define: {
    'import.meta.env.VITE_GOOGLE_CLIENT_ID': JSON.stringify(
      '1055399969589-d9chat8ol17gdt9ljqpastmo69pi7f2q.apps.googleusercontent.com'
    ),
  },
  server: {
    watch: {
      ignored: ['**/android-sdk/**', '**/android/**'],
    },
  },
});
