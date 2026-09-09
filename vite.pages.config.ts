import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Demo site for GitHub Pages: https://kobimantzur.github.io/company-brain/
export default defineConfig({
  plugins: [react()],
  base: '/company-brain/',
  build: { outDir: 'dist-pages' },
})
