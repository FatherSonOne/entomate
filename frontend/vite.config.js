import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { deploymentAssets } from './scripts/vite-deployment-assets.mjs'

const deploymentId = process.env.VERCEL_SKEW_PROTECTION_ENABLED === '1'
  ? process.env.VERCEL_DEPLOYMENT_ID
  : undefined

export default defineConfig({
  plugins: [react(), deploymentId && deploymentAssets(deploymentId)],
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
