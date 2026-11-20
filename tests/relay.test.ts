import { describe, expect, it } from 'vitest';
import { extractSubjectIds, handleSyncRequest } from '../shared/ta';

function fakeTA(opts: { goodPassword: string }) {
  const calls: string[] = [];
  const fetchFn = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    calls.push(url);
    if (url.endsWith('/yrdsb/index.php')) {
      const body = new URLSearchParams(String(init?.body));
      if (body.get('password') !== opts.goodPassword) {
        return new Response('<form><input name="password"></form>', { status: 200 });
      }
      const h = new Headers({ Location: 'https://ta.yrdsb.ca/live/students/listReports.php?student_id=777' });
      h.append('Set-Cookie', 'session_token=deleted; path=/');
      h.append('Set-Cookie', 'session_token=abc123; path=/');
      h.append('Set-Cookie', 'student_id=777; path=/');
      return new Response('', { status: 302, headers: h });
    }
    const cookie = new Headers(init?.headers).get('cookie');
    if (cookie !== 'session_token=abc123; student_id=777') return new Response('', { status: 302 });
    if (url.includes('listReports.php')) {
      return new Response('Student Reports <a href="viewReport.php?subject_id=11&student_id=777">x</a><a href="viewReport.php?subject_id=22&amp;student_id=777">y</a>');
    }
    if (url.includes('subject_id=22')) return new Response('err', { status: 500 });
    return new Response(`<html>report ${url}</html>`);
  }) as typeof fetch;
  return { fetchFn, calls };
}

const req = (body: unknown, headers: Record<string, string> = {}) =>
  new Request('https://my-ta.pages.dev/api/sync', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });

describe('relay', () => {
  it('logs in, downloads the list and every report', async () => {
    const { fetchFn, calls } = fakeTA({ goodPassword: 'pw' });
    const res = await handleSyncRequest(req({ username: '100000001', password: 'pw' }), { fetchFn });
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('no-store');
    const body = await res.json();
    expect(body.studentId).toBe('777');
    expect(Object.keys(body.reports)).toEqual(['11']);
    expect(body.failed).toEqual(['22']);
    expect(calls.every((u) => u.startsWith('https://ta.yrdsb.ca/'))).toBe(true);
  });

  it('reports bad credentials as 401', async () => {
    const { fetchFn } = fakeTA({ goodPassword: 'pw' });
    const res = await handleSyncRequest(req({ username: 'u', password: 'nope' }), { fetchFn });
    expect(res.status).toBe(401);
    expect((await res.json()).code).toBe('bad-credentials');
  });

  it('refuses other websites and wrong relay keys', async () => {
    const { fetchFn } = fakeTA({ goodPassword: 'pw' });
    const cross = await handleSyncRequest(req({ username: 'u', password: 'pw' }, { origin: 'https://evil.example' }), { fetchFn });
    expect(cross.status).toBe(403);
    const noKey = await handleSyncRequest(req({ username: 'u', password: 'pw' }), { fetchFn, relayKey: 'k' });
    expect(noKey.status).toBe(403);
    const okKey = await handleSyncRequest(req({ username: 'u', password: 'pw' }, { 'x-relay-key': 'k' }), { fetchFn, relayKey: 'k' });
    expect(okKey.status).toBe(200);
  });

  it('rejects GET and empty bodies', async () => {
    expect((await handleSyncRequest(new Request('https://x.dev/api/sync'))).status).toBe(405);
    expect((await handleSyncRequest(req({}))).status).toBe(400);
  });

  it('only extracts numeric subject ids', () => {
    expect(extractSubjectIds('viewReport.php?subject_id=5&x viewReport.php?subject_id=../../etc viewReport.php?subject_id=5')).toEqual(['5']);
  });
});
