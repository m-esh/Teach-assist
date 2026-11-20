import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { handleSyncRequest } from './shared/ta';

/** Runs the same relay code as Cloudflare during `npm run dev`. */
function devRelay(): Plugin {
  return {
    name: 'dev-relay',
    configureServer(server) {
      server.middlewares.use('/api/sync', async (req, res) => {
        const chunks: Buffer[] = [];
        for await (const c of req) chunks.push(c as Buffer);
        const url = `http://${req.headers.host}/api/sync`;
        const request = new Request(url, {
          method: req.method,
          headers: req.headers as Record<string, string>,
          body: req.method === 'POST' ? Buffer.concat(chunks) : undefined,
        });
        const response = await handleSyncRequest(request, { relayKey: process.env.RELAY_KEY });
        res.statusCode = response.status;
        response.headers.forEach((v, k) => res.setHeader(k, v));
        res.end(await response.text());
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), devRelay()],
  build: { target: 'es2020', sourcemap: false },
});
