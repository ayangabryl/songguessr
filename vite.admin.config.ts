import react from '@vitejs/plugin-react'
import { resolve } from 'node:path'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react()],
  root: resolve(import.meta.dirname, 'admin'),
  base: '/admin/',
  build: {
    outDir: resolve(import.meta.dirname, 'dist/client/admin'),
    emptyOutDir: true,
    rollupOptions: {
      input: resolve(import.meta.dirname, 'admin/index.html'),
    },
  },
})
