/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: './',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // precache the self-hosted font files too, so Rubik loads offline
      workbox: { globPatterns: ['**/*.{js,css,html,woff2}'] },
      manifest: {
        name: 'Balance',
        short_name: 'Balance',
        lang: 'he',
        dir: 'rtl',
        display: 'standalone',
        start_url: '.',
        background_color: '#ece9e2',
        theme_color: '#ece9e2',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
    }),
  ],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['tests/setup.ts'],
  },
});
