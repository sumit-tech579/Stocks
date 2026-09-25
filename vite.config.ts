import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// Vite plugin that integrates backend auth API directly into Vite dev server
function authApiPlugin(): Plugin {
  return {
    name: 'auth-api-server',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (req.url?.startsWith('/api')) {
          try {
            const { app } = await import('./server/index');
            return app(req, res, next);
          } catch (err) {
            console.error('[Vite Auth API Error]:', err);
          }
        }
        next();
      });
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), authApiPlugin()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3000,
    open: false,
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          firebase: ['firebase/app', 'firebase/auth', 'firebase/firestore'],
          charts: ['recharts'],
          icons: ['lucide-react'],
        },
      },
    },
  },
});
