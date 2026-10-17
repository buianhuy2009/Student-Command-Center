import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico','apple-touch-icon.png'],
      manifest: {
        name: 'StudentOS - Command Center',
        short_name: 'StudentOS',
        description: 'Unified academic OS: Canvas LMS, Google Workspace, AI study coaching — local-first & offline capable',
        theme_color: '#C96442',
        background_color: '#F5F4ED',
        display: 'standalone',
        scope: '/',
        start_url: '/',
        categories: ['education','productivity'],
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' }
        ],
        screenshots: [
          { src: '/screenshot-dashboard.png', sizes: '1280x720', type: 'image/png', form_factor: 'wide', label: 'Dashboard workspace' },
          { src: '/screenshot-mobile.png', sizes: '360x740', type: 'image/png', form_factor: 'narrow', label: 'Mobile dashboard' }
        ],
        shortcuts: [
          { name: 'New Task', short_name: 'Task', description: 'Create a new assignment', url: '/?newTask=1', icons: [{ src: '/icon-192.png', sizes: '192x192' }] },
          { name: 'Focus Mode', short_name: 'Focus', description: 'Start Pomodoro', url: '/?focus=1', icons: [{ src: '/icon-192.png', sizes: '192x192' }] },
          { name: 'Canvas LMS', short_name: 'Canvas', description: 'Open Canvas workspace', url: '/?w=canvas', icons: [{ src: '/icon-192.png', sizes: '192x192' }] },
          { name: 'Create Quiz', short_name: 'Quiz', description: 'Generate practice quiz', url: '/?w=quiz-generator', icons: [{ src: '/icon-192.png', sizes: '192x192' }] },
          { name: 'Search arXiv', short_name: 'arXiv', description: 'Search research papers', url: '/?w=arxiv', icons: [{ src: '/icon-192.png', sizes: '192x192' }] }
        ],
        share_target: { action: '/?share-target=1', method: 'GET', params: { title: 'title', text: 'text', url: 'url' }, enctype: 'multipart/form-data' as any }
      },
      workbox: {
        globPatterns: ['**/*.{js,css,woff2,png,svg,webp}'],
        globIgnores: ['**/index.html'],
        maximumFileSizeToCacheInBytes: 2 * 1024 * 1024,
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//, /^\/share-target/, /^\/privacy/, /^\/terms/, /^\/google-sites-home/],
        runtimeCaching: [
          { urlPattern: /^https:\/\/generativelanguage\.googleapis\.com\/.*/i, handler: 'NetworkFirst', options: { cacheName: 'gemini-api', networkTimeoutSeconds: 10, expiration: { maxEntries: 50, maxAgeSeconds: 300 } } },
          { urlPattern: /^https:\/\/www\.googleapis\.com\/.*/i, handler: 'NetworkFirst', options: { cacheName: 'googleapis-cache', networkTimeoutSeconds: 8, expiration: { maxEntries: 100, maxAgeSeconds: 300 } } },
          { urlPattern: /^https:\/\/sheets\.googleapis\.com\/.*/i, handler: 'NetworkFirst', options: { cacheName: 'sheets-api', networkTimeoutSeconds: 8, expiration: { maxEntries: 50, maxAgeSeconds: 300 } } },
          { urlPattern: /^https:\/\/gmail\.googleapis\.com\/.*/i, handler: 'NetworkFirst', options: { cacheName: 'gmail-api', networkTimeoutSeconds: 8, expiration: { maxEntries: 50, maxAgeSeconds: 300 } } },
          { urlPattern: /^https:\/\/www\.googleapis\.com\/drive\/.*/i, handler: 'NetworkFirst', options: { cacheName: 'drive-api', networkTimeoutSeconds: 8, expiration: { maxEntries: 50, maxAgeSeconds: 300 } } },
          { urlPattern: /^https:\/\/export\.arxiv\.org\/.*/i, handler: 'StaleWhileRevalidate', options: { cacheName: 'arxiv-cache', expiration: { maxEntries: 50, maxAgeSeconds: 86400 } } },
          { urlPattern: /^https:\/\/openlibrary\.org\/.*/i, handler: 'StaleWhileRevalidate', options: { cacheName: 'openlib-cache', expiration: { maxEntries: 50, maxAgeSeconds: 86400 } } },
          { urlPattern: /^https:\/\/api\.nasa\.gov\/.*/i, handler: 'StaleWhileRevalidate', options: { cacheName: 'nasa-apod-cache', expiration: { maxEntries: 20, maxAgeSeconds: 86400 } } }
        ]
      }
    })],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // Proxy /api to the express server (server.ts) so Canvas proxy + Gemini
      // endpoints work when running bare `vite` (dev:vite) without it on :3000.
      proxy: {
        '/api': {
          target: 'http://localhost:3000',
          changeOrigin: true,
        },
      },
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
     build: {
      sourcemap: false,
      reportCompressedSize: true,
      cssMinify: true,
      // brotli size reporting enabled; Vercel serves brotli — warn at 600k to surface 827k risk earlier
      rollupOptions: {
        output: {
          manualChunks: {
            vendor: ['react','react-dom','zustand'],
            firebase: ['firebase/app','firebase/auth'],
            ai: ['@google/genai'],
            // Heavy deps split + lazy-loaded only on interaction (import() in components):
            // mermaid (750k) → MermaidWorkspace only; katex fonts subset via CSS; editor/markdown chunk;
            // canvas-confetti lazy via celebrateWin(); excalidraw deferred (no static import — iframe/lazy only).
            mermaid: ['mermaid'],
            katex: ['katex'],
            markdown: ['react-markdown', 'remark-math', 'rehype-katex', 'remark-gfm'],
            dnd: ['@dnd-kit/core','@dnd-kit/sortable','@dnd-kit/utilities'],
            dexie: ['dexie']
            // CI check: run `npx vite-bundle-visualizer` on PRs; warn at 600k (brotli) per build.chunkSizeWarningLimit
          }
        }
      },
      chunkSizeWarningLimit: 600
    },
  };
});
