import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'node:path'

// Library build: `npm run build:lib` → dist-lib/. The app build (`npm run build`) is the demo site.
export default defineConfig({
  plugins: [react()],
  publicDir: false,
  build: {
    outDir: 'dist-lib',
    lib: { entry: resolve(__dirname, 'src/lib/index.ts'), formats: ['es'], fileName: 'index' },
    rollupOptions: {
      external: ['react', 'react-dom', 'react/jsx-runtime', 'three', '@react-three/fiber', '@react-three/drei'],
    },
    sourcemap: true,
    cssCodeSplit: false,
  },
})
