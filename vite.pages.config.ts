import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Demo site for GitHub Pages: https://kobimantzur.github.io/company-brain-3d/
// base must match the repo name — Pages serves the site from /<repo>/, and a stale
// base makes every asset 404 while index.html still loads (blank page, no error).
export default defineConfig({
  plugins: [react()],
  base: '/company-brain-3d/',
  build: { outDir: 'dist-pages' },
})
