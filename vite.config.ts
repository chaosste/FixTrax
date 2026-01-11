import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react()],
      define: {
        // Only expose the proxy URL, not any API keys
        'import.meta.env.VITE_PROXY_URL': JSON.stringify(env.VITE_PROXY_URL || 'https://gemini-proxy-572556903588.us-central1.run.app')
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
