import { assessmentPercent, fmt, headlineAverage, officialMark } from './calc';
import type { Course, Snapshot, Update } from './types';

const MAX_UPDATES = 300;

export const courseTitle = (c: Course) => (c.name ? `${c.code} · ${c.name}` : c.code);

function sameMarks(a: Record<string, { got: number; outOf: number; weight: number }>, b: typeof a) {
  const ka = Object.keys(a).sort();
  const kb = Object.keys(b).sort();
  if (ka.join() !== kb.join()) return false;
  return ka.every((k) => a[k].got === b[k].got && a[k].outOf === b[k].outOf && a[k].weight === b[k].weight);
}

/** Compare two syncs and describe what changed, newest first. */
export function diffSnapshots(prev: Snapshot | undefined, next: Snapshot, now = new Date()): Update[] {
  if (!prev) return [];
  const ts = now.toISOString();
  const out: Update[] = [];
  const mk = (u: Omit<Update, 'id' | 'ts' | 'seen'>): Update => ({
    ...u,
    id: `${ts}-${out.length}-${Math.random().toString(36).slice(2, 8)}`,
    ts,
    seen: false,
  });
  const prevById = new Map(prev.courses.map((c) => [c.code || c.id, c]));

  for (const c of next.courses) {
    const p = prevById.get(c.code || c.id);
    const title = courseTitle(c);
    if (!p) {
      out.push(mk({ type: 'course-added', courseId: c.id, title, subtitle: 'Course added', to: officialMark(c) }));
      continue;
    }
    if (c.report && p.report) {
      const old = new Map(p.report.assessments.map((a) => [a.name, a]));
      for (const a of c.report.assessments) {
        const o = old.get(a.name);
        const pct = assessmentPercent(a, c.report.weights);
        if (!o) {
          if (Object.keys(a.marks).length)
            out.push(mk({ type: 'evaluation-added', courseId: c.id, title, subtitle: `${a.name} added`, to: pct }));
        } else if (!sameMarks(o.marks, a.marks) && Object.keys(a.marks).length) {
          out.push(
            mk({
              type: 'evaluation-changed',
              courseId: c.id,
              title,
              subtitle: `${a.name} updated`,
              from: assessmentPercent(o, p.report.weights),
              to: pct,
            }),
          );
        }
      }
    }
    const from = officialMark(p);
    const to = officialMark(c);
    if (fmt(from) !== fmt(to)) out.push(mk({ type: 'mark-changed', courseId: c.id, title, subtitle: 'Course mark changed', from, to }));
    if (c.midterm !== null && p.midterm === null)
      out.push(mk({ type: 'midterm-added', courseId: c.id, title, subtitle: 'Midterm mark posted', to: c.midterm }));
  }

  const avgFrom = headlineAverage(prev.courses, now).value;
  const avgTo = headlineAverage(next.courses, now).value;
  if (fmt(avgFrom) !== fmt(avgTo))
    out.push(mk({ type: 'average-changed', title: 'Overall average', subtitle: 'Overall average changed', from: avgFrom, to: avgTo }));

  return out;
}

export function mergeUpdates(existing: Update[], fresh: Update[]): Update[] {
  return [...fresh, ...existing].slice(0, MAX_UPDATES);
}
