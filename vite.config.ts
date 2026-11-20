import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: './',
  // Each build gets an id; a new id on startup = a new version → safety copy first (src/core/upgrade.ts)
  define: { __APP_BUILD__: JSON.stringify(new Date().toISOString()) },
  plugins: [
    preact(),
    VitePWA({
      registerType: 'prompt', // new versions wait for "Update ready — tap to refresh" (src/ui/updatePrompt.tsx)
      includeAssets: ['workbook-512-927.pdf', 'icons/*.png'],
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,pdf,woff2}'],
        maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
      },
      manifest: {
        name: 'Eagle Project',
        short_name: 'Eagle Project',
        description: 'Plan, track and present an Eagle Scout Leadership Service Project.',
        start_url: './',
        scope: './',
        display: 'standalone',
        orientation: 'any',
        background_color: '#0f1d2b',
        theme_color: '#0f1d2b',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
});
