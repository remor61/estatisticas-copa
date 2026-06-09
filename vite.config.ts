import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base: o GitHub Pages serve o site em /<repo>/
export default defineConfig(({ command }) => ({
  plugins: [react()],
  base: command === 'build' ? '/estatisticas-copa/' : '/',
}))
