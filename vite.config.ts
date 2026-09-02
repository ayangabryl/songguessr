import react from '@vitejs/plugin-react'
import { cloudflare } from '@cloudflare/vite-plugin'
import { resolve } from 'node:path'
import { defineConfig, type Plugin } from 'vite'

function inlineGameCss(): Plugin {
  return {
    name: 'inline-game-css',
    apply: 'build',
    enforce: 'post',
    transformIndexHtml(html, ctx) {
      const bundle = ctx.bundle
      if (!bundle) return html

      let next = html
      for (const output of Object.values(bundle)) {
        if (output.type !== 'asset' || typeof output.source !== 'string') continue
        if (!output.fileName.endsWith('.css')) continue
        const fileName = output.fileName.replace(/\\/g, '/').split('/').at(-1)
        if (!fileName) continue
        const tag = new RegExp(
          `<link[^>]*rel="stylesheet"[^>]*href="[^"]*${fileName.replace('.', '\\.')}[^"]*"[^>]*>`,
          'u',
        )
        if (tag.test(next)) {
          next = next.replace(tag, `<style>${output.source}</style>`)
        }
      }
      return next
    },
  }
}

export default defineConfig({
  plugins: [react(), cloudflare(), inlineGameCss()],
  resolve: {
    alias: {
      '@': resolve(import.meta.dirname, 'admin'),
    },
  },
  build: {
    target: 'es2022',
    cssCodeSplit: true,
    modulePreload: { polyfill: false },
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
