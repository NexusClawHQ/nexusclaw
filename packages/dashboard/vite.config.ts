import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Dev proxy: the dashboard talks to the community backend's GraphQL endpoint.
// Override with COMMUNITY_PROXY_TARGET when the backend runs elsewhere.
const proxyTarget =
  process.env.COMMUNITY_PROXY_TARGET ?? 'http://localhost:3000';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/graphql': { target: proxyTarget, changeOrigin: true },
    },
  },
  preview: {
    port: 4173,
    proxy: {
      '/graphql': { target: proxyTarget, changeOrigin: true },
    },
  },
});
