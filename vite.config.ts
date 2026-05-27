import { defineConfig } from 'vite'

export default defineConfig({
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
