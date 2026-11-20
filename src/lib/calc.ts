import type { Assessment, Course, CourseReport } from './types';

/**
 * TeachAssist's formula:
 *   category average = Σ(got/outOf × weight) / Σ(weight)   over counted marks
 *   course mark      = Σ(category average × course weighting) / Σ(course weighting)
 *                      over categories that have at least one counted mark.
 */

export function counted(a: Assessment, key: string) {
  const m = a.marks[key];
  return !!m && !a.excluded && !m.excluded && m.outOf > 0 && m.weight > 0 && Number.isFinite(m.got);
}

export function categoryAverages(report: Pick<CourseReport, 'categories'>, assessments: Assessment[]): Record<string, number | null> {
  const out: Record<string, number | null> = {};
  for (const c of report.categories) {
    let num = 0;
    let den = 0;
    for (const a of assessments) {
      if (!counted(a, c.key)) continue;
      const m = a.marks[c.key];
      num += (m.got / m.outOf) * m.weight;
      den += m.weight;
    }
    out[c.key] = den > 0 ? (num / den) * 100 : null;
  }
  return out;
}

export function courseMark(
  report: Pick<CourseReport, 'categories'>,
  weights: Record<string, number>,
  assessments: Assessment[],
): number | null {
  const avgs = categoryAverages(report, assessments);
  let num = 0;
  let den = 0;
  for (const c of report.categories) {
    const avg = avgs[c.key];
    const w = weights[c.key] ?? 0;
    if (avg === null || w <= 0) continue;
    num += avg * w;
    den += w;
  }
  if (den > 0) return num / den;
  // Every category with marks has 0 weight: fall back to a plain average so we still show something.
  const vals = Object.values(avgs).filter((v): v is number => v !== null);
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
}

/** Percentage of a single evaluation (weighted across its categories, course weights applied). */
export function assessmentPercent(a: Assessment, weights: Record<string, number>): number | null {
  let num = 0;
  let den = 0;
  let plainNum = 0;
  let plainDen = 0;
  for (const [key, m] of Object.entries(a.marks)) {
    if (!(m.outOf > 0) || m.excluded) continue;
    const pct = m.got / m.outOf;
    const w = (weights[key] ?? 0) * (m.weight || 0);
    num += pct * w;
    den += w;
    plainNum += pct;
    plainDen += 1;
  }
  if (den > 0) return (num / den) * 100;
  return plainDen > 0 ? (plainNum / plainDen) * 100 : null;
}

export function categoriesWithData(report: CourseReport, assessments = report.assessments): string[] {
  const avgs = categoryAverages(report, assessments);
  return report.categories.filter((c) => avgs[c.key] !== null).map((c) => c.key);
}

/**
 * When TeachAssist doesn't publish weightings but does print the course mark,
 * and exactly two categories have marks, the split between them can be solved
 * for exactly.
 */
export function applyInference(report: CourseReport): CourseReport {
  if (report.weightSource !== 'estimated' || report.reportedMark === undefined) return report;
  const avgs = categoryAverages(report, report.assessments);
  const keys = report.categories.filter((c) => avgs[c.key] !== null).map((c) => c.key);
  if (keys.length !== 2) return report;
  const [k1, k2] = keys;
  const p1 = avgs[k1]!;
  const p2 = avgs[k2]!;
  if (Math.abs(p1 - p2) < 1) return report;
  const r = (report.reportedMark - p2) / (p1 - p2);
  if (!(r > 0.01 && r < 0.99)) return report;
  const total = (report.weights[k1] ?? 0) + (report.weights[k2] ?? 0) || 100;
  return {
    ...report,
    weights: { ...report.weights, [k1]: r * total, [k2]: (1 - r) * total },
    weightSource: 'inferred',
  };
}

/** The mark the app shows for a course: TeachAssist's own number when it printed one. */
export function officialMark(course: Course): number | null {
  const r = course.report;
  if (r?.reportedMark !== undefined) return r.reportedMark;
  if (r) {
    const m = courseMark(r, r.weights, r.assessments);
    if (m !== null) return m;
    // Couldn't read the evaluations: TeachAssist's own Term Work figure beats the list page.
    if (r.format === 'expectations' && r.reportedAverages?.term !== undefined) return r.reportedAverages.term;
  }
  // TeachAssist's list shows "current mark = 0.0%" for some report types even
  // when the real mark is high. Without a readable report, that 0 isn't a mark.
  if (course.listMark === 0 && !r?.assessments.some((a) => Object.keys(a.marks).length)) return null;
  return course.listMark;
}

/**
 * The mark a course contributes to your average: its final mark once there is
 * one, else its current mark, else its midterm (so a course whose only mark is
 * a midterm still counts until a newer mark replaces it).
 */
export function averageMark(course: Course): number | null {
  return course.final ?? officialMark(course) ?? course.midterm ?? null;
}

export type MarkSource = 'final' | 'current' | 'midterm' | null;
export function averageSource(course: Course): MarkSource {
  if (course.final !== null && course.final !== undefined) return 'final';
  if (officialMark(course) !== null) return 'current';
  return course.midterm !== null ? 'midterm' : null;
}

export function overallAverage(courses: Course[]): number | null {
  const marks = courses.map(averageMark).filter((m): m is number => m !== null);
  return marks.length ? marks.reduce((a, b) => a + b, 0) / marks.length : null;
}

export interface RequiredResult {
  kind: 'needed' | 'guaranteed' | 'impossible' | 'invalid';
  percent?: number;
  /** Best mark possible with 100% on it. */
  max?: number;
  /** Mark with 0% on it. */
  min?: number;
}

/**
 * What uniform % on a new evaluation (with the given per-category weights)
 * brings the course mark to `target`?
 */
export function requiredForTarget(
  report: Pick<CourseReport, 'categories'>,
  weights: Record<string, number>,
  assessments: Assessment[],
  evalWeights: Record<string, number>,
  target: number,
): RequiredResult {
  const active = Object.entries(evalWeights).filter(([, w]) => w > 0);
  if (!active.length || !Number.isFinite(target)) return { kind: 'invalid' };
  const markWith = (pct: number) => {
    const hyp: Assessment = {
      id: '__needed',
      name: 'needed',
      marks: Object.fromEntries(active.map(([k, w]) => [k, { got: pct, outOf: 100, weight: w }])),
    };
    return courseMark(report, weights, [...assessments, hyp]) ?? 0;
  };
  const min = markWith(0);
  const max = markWith(100);
  if (Math.abs(max - min) < 1e-9) return { kind: 'invalid', min, max };
  if (min >= target) return { kind: 'guaranteed', percent: 0, min, max };
  if (max < target) return { kind: 'impossible', min, max, percent: undefined };
  let lo = 0;
  let hi = 100;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (markWith(mid) >= target) hi = mid;
    else lo = mid;
  }
  return { kind: 'needed', percent: hi, min, max };
}

export const fmt = (n: number | null | undefined, d = 1) =>
  n === null || n === undefined || !Number.isFinite(n) ? '—' : (Math.round(n * 10 ** d) / 10 ** d).toFixed(d);

const isoDay = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export function isActive(c: Course, now = new Date()): boolean {
  const today = isoDay(now);
  return !!c.start && !!c.end && c.start <= today && today <= c.end;
}

/** Average of the courses running right now (falls back to every course with a mark). */
export function headlineAverage(
  courses: Course[],
  now = new Date(),
): { value: number | null; count: number; scope: 'current' | 'all'; midterms: number; finals: number } {
  const active = courses.filter((c) => isActive(c, now) && averageMark(c) !== null);
  const pool = active.length ? active : courses.filter((c) => averageMark(c) !== null);
  return {
    value: overallAverage(pool),
    count: pool.length,
    scope: active.length ? 'current' : 'all',
    midterms: pool.filter((c) => averageSource(c) === 'midterm').length,
    finals: pool.filter((c) => averageSource(c) === 'final').length,
  };
}

/** The report with any weight corrections the user saved applied. */
export function effectiveReport(course: Course, overrides: Record<string, Record<string, number>>): CourseReport | undefined {
  const r = course.report;
  if (!r) return undefined;
  const o = overrides[course.code];
  return o ? { ...r, weights: { ...r.weights, ...o }, weightSource: 'custom' } : r;
}
