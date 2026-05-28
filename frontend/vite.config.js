import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load env variables from the parent directory ('../') where the env files are located
  const env = loadEnv(mode, '../', '');

  return {
    envDir: '../',
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        devOptions: {
          enabled: true // Crucial: Makes Service Worker active on localhost dev mode!
        },
        includeAssets: ['favicon.svg', 'icon-192.png', 'icon-512.png'],
        manifest: {
          name: 'FarmEase AgriTech Platform',
          short_name: 'FarmEase',
          description: 'Connecting Farmers, Workers, and Agri-businesses end-to-end.',
          theme_color: '#10b981',
          background_color: '#000000',
          display: 'standalone',
          orientation: 'portrait',
          icons: [
            {
              src: 'icon-192.png',
              sizes: '192x192',
              type: 'image/png'
            },
            {
              src: 'icon-512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any maskable'
            }
          ]
        }
      })
    ],
    server: {
      port: 5173,
      proxy: {
        '/api': {
          target: env.VITE_API_BASE_URL || `http://localhost:${env.PORT || 5000}`,
          changeOrigin: true,
          secure: false,
          ws: true // enables WebSockets proxying for Socket.io!
        }
      }
    }
  };
});
