import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
  },
  test: {
    globals: true,
    environment: 'happy-dom',
    include: ['tests/**/*.{test,spec}.{ts,tsx}'],
    setupFiles: ['./tests/setup.ts'],
  },
});
