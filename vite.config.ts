import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: { port: Number(process.env.PORT) || 5174 },
  worker: { format: 'es' },
  // MapLibre v6 loads its tile worker via new URL(..., import.meta.url); pre-bundling breaks that path.
  optimizeDeps: { exclude: ['maplibre-gl'] },
})
