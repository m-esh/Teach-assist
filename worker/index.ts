/// <reference types="@cloudflare/workers-types" />
/**
 * Cloudflare Worker entry: serves the app's static files and the /api/sync relay.
 * Nothing is logged or stored here; credentials live only for the length of a request.
 */
import { handleSyncRequest } from '../shared/ta';

interface Env {
  ASSETS: Fetcher;
  /** Optional. If set, the app must send this key (Settings > Advanced > Relay Key). */
  RELAY_KEY?: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === '/api/sync') return handleSyncRequest(request, { relayKey: env.RELAY_KEY || undefined });
    if (url.pathname.startsWith('/api/')) return new Response('Not found', { status: 404 });
    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;
