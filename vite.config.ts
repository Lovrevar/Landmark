import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    {
      name: 'supabase-auth-proxy',
      configureServer(server) {
        server.middlewares.use('/api/auth/login', async (req, res) => {
          if (req.method === 'POST') {
            let body = '';
            req.on('data', chunk => body += chunk);
            req.on('end', async () => {
              try {
                const { email, password } = JSON.parse(body);

                const authResponse = await fetch(
                  `https://xhlgviunhitdgzkeucxc.supabase.co/auth/v1/token?grant_type=password`,
                  {
                    method: 'POST',
                    headers: {
                      'apikey': process.env.VITE_SUPABASE_ANON_KEY || '',
                      'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ email, password })
                  }
                );

                const data = await authResponse.json();

                res.setHeader('Content-Type', 'application/json');
                res.statusCode = authResponse.status;
                res.end(JSON.stringify(data));
              } catch (error) {
                res.statusCode = 500;
                res.end(JSON.stringify({ error: 'Internal server error' }));
              }
            });
          } else {
            res.statusCode = 405;
            res.end('Method not allowed');
          }
        });
      }
    }
  ],
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
});
