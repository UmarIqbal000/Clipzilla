import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/jobs': { target: 'http://127.0.0.1:8000', changeOrigin: true },
      '/clips': { target: 'http://127.0.0.1:8000', changeOrigin: true },
      '/settings': { target: 'http://127.0.0.1:8000', changeOrigin: true },
      '/health': { target: 'http://127.0.0.1:8000', changeOrigin: true },
      '/batches': { target: 'http://127.0.0.1:8000', changeOrigin: true },
      '/presets': { target: 'http://127.0.0.1:8000', changeOrigin: true },
      '/history': { target: 'http://127.0.0.1:8000', changeOrigin: true },
    }
  },
  preview: {
    port: 5173,
    proxy: {
      '/jobs': { target: 'http://127.0.0.1:8000', changeOrigin: true },
      '/clips': { target: 'http://127.0.0.1:8000', changeOrigin: true },
      '/settings': { target: 'http://127.0.0.1:8000', changeOrigin: true },
      '/health': { target: 'http://127.0.0.1:8000', changeOrigin: true },
      '/batches': { target: 'http://127.0.0.1:8000', changeOrigin: true },
      '/presets': { target: 'http://127.0.0.1:8000', changeOrigin: true },
      '/history': { target: 'http://127.0.0.1:8000', changeOrigin: true },
    }
  }
})
