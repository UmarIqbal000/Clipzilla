import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const htmlBypass = (req) => {
  if (req.headers.accept && req.headers.accept.includes('text/html')) {
    return '/index.html';
  }
};

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: {
      '/jobs': { target: 'http://127.0.0.1:8000', changeOrigin: true, bypass: htmlBypass },
      '/clips': { target: 'http://127.0.0.1:8000', changeOrigin: true, bypass: htmlBypass },
      '/settings': { target: 'http://127.0.0.1:8000', changeOrigin: true, bypass: htmlBypass },
      '/health': { target: 'http://127.0.0.1:8000', changeOrigin: true, bypass: htmlBypass },
      '/batches': { target: 'http://127.0.0.1:8000', changeOrigin: true, bypass: htmlBypass },
      '/presets': { target: 'http://127.0.0.1:8000', changeOrigin: true, bypass: htmlBypass },
      '/history': { target: 'http://127.0.0.1:8000', changeOrigin: true, bypass: htmlBypass },
      '/social-accounts': { target: 'http://127.0.0.1:8000', changeOrigin: true, bypass: htmlBypass },
      '/publish-jobs': { target: 'http://127.0.0.1:8000', changeOrigin: true, bypass: htmlBypass },
    }
  },
  preview: {
    host: '0.0.0.0',
    port: 5173,
    proxy: {
      '/jobs': { target: 'http://127.0.0.1:8000', changeOrigin: true, bypass: htmlBypass },
      '/clips': { target: 'http://127.0.0.1:8000', changeOrigin: true, bypass: htmlBypass },
      '/settings': { target: 'http://127.0.0.1:8000', changeOrigin: true, bypass: htmlBypass },
      '/health': { target: 'http://127.0.0.1:8000', changeOrigin: true, bypass: htmlBypass },
      '/batches': { target: 'http://127.0.0.1:8000', changeOrigin: true, bypass: htmlBypass },
      '/presets': { target: 'http://127.0.0.1:8000', changeOrigin: true, bypass: htmlBypass },
      '/history': { target: 'http://127.0.0.1:8000', changeOrigin: true, bypass: htmlBypass },
    }
  }
})
