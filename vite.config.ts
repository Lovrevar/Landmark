import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-supabase': ['@supabase/supabase-js'],
          'vendor-icons': ['lucide-react'],
          'vendor-pdf': ['jspdf'],
          'vendor-xlsx': ['@e965/xlsx'],
          'vendor-charts': ['recharts'],
        },
      },
    },
    chunkSizeWarningLimit: 600,
  },
});
