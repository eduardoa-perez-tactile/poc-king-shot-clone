import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  // Use relative asset paths so the app works on GitHub Pages project URLs.
  base: './',
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    port: 5174
  }
})
