import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  define: {
    // Sentry release: the commit Vercel is building (empty locally)
    __APP_RELEASE__: JSON.stringify(process.env.VERCEL_GIT_COMMIT_SHA || ''),
    // Sentry environment; empty locally, which keeps Sentry off
    __APP_ENV__: JSON.stringify(process.env.VERCEL_ENV || ''),
  },
  server: {
    port: 5175,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        secure: false
      },
      '/hooks': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        secure: false
      },
      '/logos': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        secure: false
      }
    }
  }
})
