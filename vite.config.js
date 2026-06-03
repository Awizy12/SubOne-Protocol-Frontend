import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { nodePolyfills } from 'vite-plugin-node-polyfills'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    nodePolyfills({
      // Specifies whether to polyfill specific globals.
      globals: {
        Buffer: true, 
        global: true,
        process: true,
      },
      // Whether to polyfill Node.js modules like 'util'
      protocolImports: true,
    }),
  ],
})