import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Lets the app call the API with relative URLs (VITE_API_BASE_URL=""),
  // so devices on the LAN only need to reach the Vite server.
  server: {
    host: true,
    proxy: {
      '/api': 'http://localhost:3000',
      '/users': 'http://localhost:3000',
    },
  },
  test: {
    include: ['src/**/*.test.{ts,tsx}'],
    // Pin the API base so tests don't depend on each dev's .env.local.
    env: { VITE_API_BASE_URL: 'http://localhost:3000' },
  },
})
