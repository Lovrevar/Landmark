import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        // Function form so we can also peel the (large) i18n locale JSON and a
        // few heavy libraries out of the entry chunk, not just the headline
        // vendors. Each returns a stable, independently-cacheable chunk name.
        manualChunks(id) {
          // ~380 KB of translation JSON was being inlined into the entry.
          if (id.includes('/locales/')) return 'i18n-locales';

          if (id.includes('node_modules')) {
            if (/node_modules\/(react|react-dom|react-router|react-router-dom|scheduler)\//.test(id)) return 'vendor-react';
            if (id.includes('@supabase')) return 'vendor-supabase';
            if (id.includes('lucide-react')) return 'vendor-icons';
            if (id.includes('jspdf')) return 'vendor-pdf';
            if (id.includes('xlsx')) return 'vendor-xlsx';
            if (id.includes('recharts') || id.includes('/d3-') || id.includes('victory-vendor')) return 'vendor-charts';
            // react-markdown + its remark/micromark/mdast/hast/unist ecosystem.
            if (/(react-markdown|remark|rehype|micromark|mdast|hast|unist|vfile|property-information|decode-named-character-reference|character-entities|comma-separated-tokens|space-separated-tokens|trim-lines|trough|bail|is-plain-obj|zwitch|html-void-elements|ccount|escape-string-regexp|markdown-table|longest-streak|devlop)/.test(id)) return 'vendor-markdown';
            if (id.includes('date-fns')) return 'vendor-date-fns';
            if (id.includes('rrule')) return 'vendor-rrule';
            if (id.includes('i18next')) return 'vendor-i18n';
            if (id.includes('@tanstack')) return 'vendor-virtual';
            // Everything else falls through to Rollup's default splitting, which
            // keeps jspdf's dynamically-imported html2canvas/dompurify as their
            // own lazy chunks (only fetched when a PDF is actually generated).
          }
        },
      },
    },
    chunkSizeWarningLimit: 600,
  },
});
