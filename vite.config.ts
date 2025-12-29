/// <reference types="vitest" />
import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    // Load all env variables (including those without VITE_ prefix)
    const env = loadEnv(mode, process.cwd(), '');
    const isProduction = mode === 'production';

    return {
      server: {
        port: 5173,  // Use 5173 to avoid conflict with backend on 3000
        host: '0.0.0.0',
      },
      plugins: [react()],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.VITE_SUPABASE_URL': JSON.stringify(env.VITE_SUPABASE_URL),
        'process.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(env.VITE_SUPABASE_ANON_KEY),
        'process.env.NODE_ENV': JSON.stringify(mode)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      },
      build: {
        outDir: 'dist',
        sourcemap: !isProduction,
        minify: isProduction ? 'esbuild' : false,
        rollupOptions: {
          output: {
            manualChunks: {
              vendor: ['react', 'react-dom'],
              supabase: ['@supabase/supabase-js'],
              genai: ['@google/genai']
            }
          }
        },
        chunkSizeWarningLimit: 1000
      },
      preview: {
        port: 4173,
        host: '0.0.0.0'
      },
      test: {
        globals: true,
        environment: 'node',
        include: ['src/**/*.test.ts', 'tests/**/*.test.ts'],
        coverage: {
          provider: 'v8',
          reporter: ['text', 'json', 'html'],
          include: ['src/**/*.ts'],
          exclude: ['src/**/*.d.ts', 'src/**/*.test.ts']
        }
      }
    };
});
