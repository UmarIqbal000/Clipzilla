import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/jobs': 'http://localhost:8000',
      '/clips': 'http://localhost:8000',
      '/settings': 'http://localhost:8000',
      '/health': 'http://localhost:8000',
      '/batches': 'http://localhost:8000',
      '/presets': 'http://localhost:8000',
      '/history': 'http://localhost:8000',
    }
  }
})
