import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'node:path'

// Standalone iframe bundle: one self-contained page you can drop on any site,
// regardless of the host's React version. `npm run build:embed` → dist-embed/
export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    outDir: 'dist-embed',
    rollupOptions: { input: resolve(__dirname, 'standalone.html') },
  },
})
