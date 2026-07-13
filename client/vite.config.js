/**
 * File purpose: Configures Vite and the React plugin used to run and build the browser application.
 */
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Vite keeps the React app fast in development and creates a static build for Vercel/Netlify.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: false,
    // Proxying auth through Vite avoids localhost/127.0.0.1 cookie-site mismatches.
    proxy: {
      '/api': 'http://localhost:5000',
    },
  },
  // Production uses the equivalent Vercel rewrite; this keeps `vite preview` testable locally.
  preview: {
    proxy: {
      '/api': 'http://localhost:5000',
    },
  },
});
