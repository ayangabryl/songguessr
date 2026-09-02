import react from '@vitejs/plugin-react'
import { cloudflare } from '@cloudflare/vite-plugin'
import { resolve } from 'node:path'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react(), cloudflare({ tunnel: true })],
  resolve: {
    alias: {
      '@': resolve(import.meta.dirname, 'admin'),
    },
  },
  optimizeDeps: {
    exclude: ['@phosphor-icons/react'],
  },
  server: {
    host: '127.0.0.1',
    port: 3000,
    strictPort: true,
  },
})
