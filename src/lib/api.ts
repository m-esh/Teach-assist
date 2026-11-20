import { parseCourseList, parseReport } from './parse';
import type { Snapshot } from './types';

interface SyncPayload {
  studentId: string;
  fetchedAt: string;
  listHtml: string;
  reports: Record<string, string>;
  failed: string[];
}

export class SyncError extends Error {
  constructor(
    message: string,
    public code: string,
  ) {
    super(message);
  }
}

export function buildSnapshot(payload: SyncPayload): Snapshot {
  const courses = parseCourseList(payload.listHtml);
  for (const c of courses) {
    if (c.id.startsWith('code:')) continue;
    const html = payload.reports[c.id];
    if (!html) {
      c.reportError = payload.failed.includes(c.id)
        ? 'Could not download this report from TeachAssist.'
        : "TeachAssist didn't send this course's detailed report.";
      continue;
    }
    try {
      const report = parseReport(html);
      if (report) c.report = report;
      else c.reportError = "This report's layout wasn't recognised. The course mark is still shown.";
    } catch {
      c.reportError = "This report couldn't be read. The course mark is still shown.";
    }
  }
  return { fetchedAt: payload.fetchedAt, studentId: payload.studentId, courses };
}

export async function fetchSnapshot(username: string, password: string, relayKey = ''): Promise<Snapshot> {
  let res: Response;
  try {
    res = await fetch('/api/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(relayKey ? { 'X-Relay-Key': relayKey } : {}) },
      body: JSON.stringify({ username, password }),
      cache: 'no-store',
      credentials: 'omit',
    });
  } catch {
    throw new SyncError("You're offline. Showing your last saved marks.", 'offline');
  }
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    /* non-JSON */
  }
  if (!res.ok) {
    const b = body as { error?: string; code?: string } | null;
    throw new SyncError(b?.error ?? `Sync failed (${res.status}).`, b?.code ?? 'unexpected');
  }
  const payload = body as SyncPayload;
  const snap = buildSnapshot(payload);
  if (!snap.courses.length) throw new SyncError('Logged in, but no courses were found on TeachAssist.', 'empty');
  return snap;
}
