import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['vite.svg'],
      manifest: {
        name: 'JStart',
        short_name: 'JStart',
        description: 'A beautiful start page',
        theme_color: '#1a1a2e',
        background_color: '#1a1a2e',
        display: 'standalone',
        icons: [
          {
            src: 'vite.svg',
            sizes: 'any',
            type: 'image/svg+xml'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/bing\.biturl\.top\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'bing-wallpaper-api',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24
              }
            }
          },
          {
            urlPattern: /^https:\/\/.*\.bing\.net\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'bing-wallpaper-images',
              expiration: {
                maxEntries: 5,
                maxAgeSeconds: 60 * 60 * 24 * 7
              }
            }
          },
          {
            urlPattern: /^https:\/\/wttr\.in\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'weather-api',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60
              }
            }
          },
          {
            urlPattern: /^https:\/\/api-cdt\.junpgle\.me\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 24
              }
            }
          }
        ]
      }
    })
  ],
  server: {
    proxy: {
      '/sug/bing': {
        target: 'https://api.bing.com',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/sug\/bing/, '')
      },
      '/sug/baidu': {
        target: 'https://suggestion.baidu.com',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/sug\/baidu/, '')
      },
      '/sug/google': {
        target: 'https://suggestqueries.google.com',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/sug\/google/, '')
      }
    }
  }
})
