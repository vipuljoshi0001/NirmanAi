import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    // Leaflet + Recharts + the dashboard bundle legitimately exceed Vite's
    // default 500 kB comfort zone; the biggest JS chunk is ~1.08 MB, so set
    // the ceiling just above it to keep the build warning-free.
    chunkSizeWarningLimit: 1200,
  },
  server: {
    host: true,
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
    },
  },
})
