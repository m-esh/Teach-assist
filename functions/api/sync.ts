/// <reference types="@cloudflare/workers-types" />
import { handleSyncRequest } from '../../shared/ta';

interface Env {
  /** Optional. If set in Cloudflare, the app must send this key (Settings > Relay key). */
  RELAY_KEY?: string;
}

// Nothing is logged or stored here: credentials live only for the length of the request.
export const onRequest: PagesFunction<Env> = ({ request, env }) =>
  handleSyncRequest(request, { relayKey: env.RELAY_KEY || undefined });
