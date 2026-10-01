import { defineConfig } from 'vite'
import { readdirSync, existsSync } from 'node:fs'
import { resolve, join, relative } from 'node:path'

const root = resolve(import.meta.dirname, 'frontend')

// Every .html page under frontend/ is an entry point (multi-page app)
const findPages = (dir) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) return entry.name === 'public' ? [] : findPages(path)
    return entry.name.endsWith('.html') ? [path] : []
  })

const input = Object.fromEntries(
  findPages(root).map((file) => [relative(root, file).replace(/\.html$/, ''), file])
)

// Dev server: serve clean URLs (/wallet -> wallet.html) the way Vercel does in production
const cleanUrls = () => ({
  name: 'clean-urls',
  configureServer(server) {
    server.middlewares.use((req, _res, next) => {
      const [path, query] = req.url.split('?')
      if (path !== '/' && !path.includes('.') && existsSync(join(root, `${path}.html`))) {
        req.url = `${path}.html${query ? `?${query}` : ''}`
      }
      next()
    })
  },
})

export default defineConfig({
  root,
  publicDir: 'public',
  plugins: [cleanUrls()],
  build: {
    outDir: resolve(import.meta.dirname, 'dist'),
    emptyOutDir: true,
    // Pages use top-level await; ES2022 = Safari/iOS 15+, Chrome 89+
    target: 'es2022',
    rollupOptions: { input },
  },
})
