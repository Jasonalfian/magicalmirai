import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Vite config — includes polyfills needed by textalive-app-api (CommonJS package)
export default defineConfig({
  plugins: [react()],
  define: {
    global: 'globalThis',
    'process.env': {},
  },
  optimizeDeps: {
    include: ['textalive-app-api'],
  },
})
