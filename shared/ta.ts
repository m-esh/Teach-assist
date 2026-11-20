/**
 * TeachAssist (YRDSB) fetch logic used by the relay.
 *
 * Runs on Cloudflare Pages Functions (and in the local dev server). It is
 * deliberately dumb and stateless: log in, download the course list page and
 * each course report page, hand the raw HTML back to the app, and forget
 * everything. Parsing happens on the device.
 *
 * Only fixed paths on ta.yrdsb.ca are ever requested, so the relay can't be
 * used as a general-purpose proxy.
 */

export const TA_ORIGIN = 'https://ta.yrdsb.ca';
const LOGIN_URL = `${TA_ORIGIN}/yrdsb/index.php`;
const USER_AGENT =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';

export interface SyncPayload {
  studentId: string;
  fetchedAt: string;
  listHtml: string;
  /** subject_id -> report page HTML */
  reports: Record<string, string>;
  /** subject_ids whose report could not be downloaded */
  failed: string[];
}

export class TAError extends Error {
  constructor(
    message: string,
    public status: number,
    public code: 'bad-credentials' | 'unreachable' | 'unexpected' | 'bad-request',
  ) {
    super(message);
  }
}

type FetchFn = typeof fetch;

function getSetCookies(headers: Headers): string[] {
  const h = headers as Headers & { getSetCookie?: () => string[] };
  if (typeof h.getSetCookie === 'function') return h.getSetCookie();
  const raw = headers.get('set-cookie');
  // Fallback split: commas inside Expires dates are followed by a space + digit.
  return raw ? raw.split(/,(?=\s*[A-Za-z0-9_-]+=)/) : [];
}

function cookieValue(setCookies: string[], name: string): string | undefined {
  let found: string | undefined;
  for (const c of setCookies) {
    const m = c.trim().match(new RegExp(`^${name}=([^;]*)`));
    if (m && m[1] && m[1] !== 'deleted') found = m[1];
  }
  return found;
}

async function timedFetch(fetchFn: FetchFn, url: string, init: RequestInit, ms = 15000): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetchFn(url, { ...init, signal: ctrl.signal });
  } catch {
    throw new TAError('Could not reach TeachAssist. It may be down - try again in a bit.', 504, 'unreachable');
  } finally {
    clearTimeout(t);
  }
}

export async function login(username: string, password: string, fetchFn: FetchFn = fetch) {
  const body = new URLSearchParams({ subject_id: '0', username, password, submit: 'Login' });
  const res = await timedFetch(fetchFn, LOGIN_URL, {
    method: 'POST',
    redirect: 'manual',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': USER_AGENT,
      Accept: 'text/html',
    },
    body: body.toString(),
  });
  const cookies = getSetCookies(res.headers);
  const token = cookieValue(cookies, 'session_token');
  const location = res.headers.get('location') ?? '';
  const studentId = location.match(/student_id=(\d+)/)?.[1] ?? cookieValue(cookies, 'student_id');
  // Drain body so the connection can be reused.
  await res.text().catch(() => '');
  if (!token || !studentId) {
    throw new TAError('TeachAssist rejected that student number or password.', 401, 'bad-credentials');
  }
  return { token, studentId };
}

async function getPage(path: string, cookie: string, fetchFn: FetchFn): Promise<string> {
  const res = await timedFetch(fetchFn, `${TA_ORIGIN}${path}`, {
    redirect: 'manual',
    headers: { Cookie: cookie, 'User-Agent': USER_AGENT, Accept: 'text/html' },
  });
  const text = await res.text();
  if (res.status >= 300 && res.status < 400) {
    throw new TAError('TeachAssist ended the session unexpectedly. Try again.', 502, 'unexpected');
  }
  if (!res.ok) throw new TAError(`TeachAssist returned an error (${res.status}).`, 502, 'unexpected');
  return text;
}

export function extractSubjectIds(listHtml: string): string[] {
  const ids = new Set<string>();
  const re = /viewReport\.php\?subject_id=(\d+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(listHtml))) ids.add(m[1]);
  return [...ids].slice(0, 30);
}

export async function syncTeachAssist(username: string, password: string, fetchFn: FetchFn = fetch): Promise<SyncPayload> {
  const { token, studentId } = await login(username, password, fetchFn);
  const cookie = `session_token=${token}; student_id=${studentId}`;
  const listHtml = await getPage(`/live/students/listReports.php?student_id=${studentId}`, cookie, fetchFn);
  if (!/listReports|Student Reports|viewReport\.php|Course Name/i.test(listHtml)) {
    throw new TAError('TeachAssist returned a page this app does not recognise.', 502, 'unexpected');
  }
  const ids = extractSubjectIds(listHtml);
  const reports: Record<string, string> = {};
  const failed: string[] = [];
  // Two at a time with one retry: gentle on TeachAssist and resilient to a flaky page.
  const queue = [...ids];
  const worker = async () => {
    for (let id = queue.shift(); id !== undefined; id = queue.shift()) {
      const path = `/live/students/viewReport.php?subject_id=${id}&student_id=${studentId}`;
      try {
        reports[id] = await getPage(path, cookie, fetchFn);
      } catch {
        try {
          reports[id] = await getPage(path, cookie, fetchFn);
        } catch {
          failed.push(id);
        }
      }
    }
  };
  await Promise.all([worker(), worker()]);
  return { studentId, fetchedAt: new Date().toISOString(), listHtml, reports, failed };
}

/** Shared request handler: used by the Cloudflare function and the dev server. */
export async function handleSyncRequest(request: Request, opts: { relayKey?: string; fetchFn?: FetchFn } = {}): Promise<Response> {
  const json = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), {
      status,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });

  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  // Only the app itself (same origin) may call the relay from a browser.
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin) return json({ error: 'Forbidden' }, 403);

  if (opts.relayKey && request.headers.get('x-relay-key') !== opts.relayKey) {
    return json({ error: 'This relay needs an access key. Add it in Settings.', code: 'relay-key' }, 403);
  }

  let username = '';
  let password = '';
  try {
    const body = (await request.json()) as { username?: unknown; password?: unknown };
    username = typeof body.username === 'string' ? body.username.trim() : '';
    password = typeof body.password === 'string' ? body.password : '';
  } catch {
    /* fall through */
  }
  if (!username || !password || username.length > 64 || password.length > 128) {
    return json({ error: 'Missing student number or password.', code: 'bad-request' }, 400);
  }

  try {
    const payload = await syncTeachAssist(username, password, opts.fetchFn);
    return json(payload);
  } catch (e) {
    if (e instanceof TAError) return json({ error: e.message, code: e.code }, e.status);
    return json({ error: 'Something went wrong talking to TeachAssist.', code: 'unexpected' }, 502);
  }
}
