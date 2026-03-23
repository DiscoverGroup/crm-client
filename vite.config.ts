import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
export default defineConfig({
  plugins: [react(),
        tailwindcss()
  ],
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      // Forward all Netlify function calls to the local functions server
      '/.netlify/functions': {
        target: 'http://localhost:9999',
        changeOrigin: true,
      },
    },
  },
})
