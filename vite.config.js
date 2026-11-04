import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // relative paths: the same build works at the server root and at user.github.io/<repo>/
  base: './',
  server: { proxy: { '/api': 'http://127.0.0.1:8020' } },
  build: { outDir: 'dist', chunkSizeWarningLimit: 800 },
})
