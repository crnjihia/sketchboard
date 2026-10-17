import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: './',
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
    proxy: {
      '/socket.io': {
        target: process.env.VITE_SERVER_URL || 'http://localhost:4000',
        ws: true,
        configure: (proxy) => {
          proxy.on('error', (err: any) => {
            // Suppress noisy socket abort/reset errors during tests or client unmounts
            if (['ECONNABORTED', 'ECONNRESET', 'EPIPE'].includes(err.code)) {
              return;
            }
            console.warn('[Vite Proxy]:', err.message);
          });
        },
      },
    },
  },
  build: {
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks: {
          'export-vendor': ['jspdf', 'html2canvas'],
          'crdt-vendor': ['yjs', 'socket.io-client'],
          'react-vendor': ['react', 'react-dom'],
        },
      },
    },
  },
});
