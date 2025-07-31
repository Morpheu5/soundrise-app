import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from "@tailwindcss/vite"
import { nodePolyfills } from 'vite-plugin-node-polyfills'

// https://vite.dev/config/
export default defineConfig({
  build: {
    sourcemap: true,
    ssr: false,
  },
  plugins: [
    tailwindcss(),
    react(),
    nodePolyfills(),
  ],
})
