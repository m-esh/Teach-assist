// @vitest-environment happy-dom
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { averageMark, categoryAverages, courseMark, headlineAverage, officialMark, requiredForTarget } from '../src/lib/calc';
import { levelToPercent, parseCourseList, parseReport } from '../src/lib/parse';

const fx = (n: string) => readFileSync(join(__dirname, 'fixtures', n), 'utf8');

describe('course list', () => {
  const courses = parseCourseList(fx('list.html'));

  it('finds every course row', () => {
    expect(courses.map((c) => c.code)).toEqual(['SPH4U1-2', 'SHAL1-34', 'MHF4U1-5', 'TDJ4M1-1', 'SCH4U1-8', 'MCV4U1-2']);
  });

  it('splits school, name, block, room and dates', () => {
    const sph = courses[0];
    expect(sph.school).toBe('YRDSB - Continuing Education Secondary - 1 Night School');
    expect(sph.name).toBe('Physics');
    expect(sph.block).toBe('1');
    expect(sph.room).toBe('Remote');
    expect(sph.start).toBe('2026-09-22');
    expect(sph.end).toBe('2027-01-21');
    expect(courses[1].name).toBe('');
    expect(courses[1].room).toBe('OFFICEHR');
  });

  it('reads midterm and current marks independently', () => {
    expect(courses[0]).toMatchObject({ midterm: 91, listMark: null, id: 'code:SPH4U1-2' });
    expect(courses[2]).toMatchObject({ midterm: 80, listMark: 84.2, id: '444001' });
    expect(courses[3]).toMatchObject({ midterm: 95, listMark: 0, id: '555002' });
    expect(courses[5]).toMatchObject({ midterm: null, listMark: null });
  });
});

describe('grid report with custom categories (Term / Attendance / Final)', () => {
  const r = parseReport(fx('report-grid.html'))!;

  it('reads categories from the header instead of assuming K/T/C/A', () => {
    expect(r.format).toBe('grid');
    expect(r.categories.map((c) => [c.short, c.label])).toEqual([
      ['T', 'Term'],
      ['A', 'Attendance, Participation'],
      ['F', 'Final Exam'],
    ]);
  });

  it('reads evaluations, weights, feedback and the not-counted (pink) item', () => {
    expect(r.assessments.map((a) => a.name)).toEqual(['Unit 0: Diagnostic Assessment of 11', 'Unit 1 Test', 'Unit 2 Test', 'Unit 3 Test', 'Missed Quiz']);
    expect(r.assessments[0].marks).toEqual({});
    expect(r.assessments[1].marks.term).toMatchObject({ got: 40, outOf: 50, weight: 1 });
    expect(r.assessments[1].feedback).toBe('Good work on factoring.');
    expect(r.assessments[4].marks.term.excluded).toBe(true);
  });

  it('matches the mark TeachAssist prints', () => {
    expect(r.reportedMark).toBe(84.2);
    expect(r.reportedAverages?.term).toBe(84.2);
    expect(courseMark(r, r.weights, r.assessments)).toBeCloseTo(84.1667, 3);
  });
});

describe('classic K/T/C/A report with weighting table', () => {
  const r = parseReport(fx('report-ktca.html'))!;

  it('uses the published course weightings and fills in the final', () => {
    expect(r.weightSource).toBe('teachassist');
    expect(r.categories.map((c) => c.short)).toEqual(['K', 'T', 'C', 'A', 'O', 'F']);
    const w = Object.fromEntries(r.categories.map((c) => [c.short, r.weights[c.key]]));
    expect(w).toEqual({ K: 17.5, T: 17.5, C: 17.5, A: 17.5, O: 0, F: 30 });
  });

  it('handles "no mark / no weight" cells', () => {
    const other = r.categories.find((c) => c.short === 'O')!;
    expect(r.assessments[1].marks[other.key]).toMatchObject({ excluded: true, weight: 0 });
  });

  it('computes category averages and the course mark like TeachAssist', () => {
    const avg = categoryAverages(r, r.assessments);
    const by = Object.fromEntries(r.categories.map((c) => [c.short, avg[c.key]]));
    expect(by).toMatchObject({ K: 85, T: 70, C: 90, A: 80, O: null, F: 90 });
    expect(courseMark(r, r.weights, r.assessments)).toBeCloseTo(83.875, 6);
    expect(r.reportedMark).toBe(83.9);
  });

  it('solves "what do I need"', () => {
    const k = r.categories[0].key;
    const res = requiredForTarget(r, r.weights, r.assessments, { [k]: 10 }, 84);
    expect(res.kind).toBe('needed');
    // Plug the answer back in: it should land exactly on the target.
    const check = courseMark(r, r.weights, [
      ...r.assessments,
      { id: 'x', name: 'x', marks: { [k]: { got: res.percent!, outOf: 100, weight: 10 } } },
    ]);
    expect(check).toBeCloseTo(84, 4);
    expect(requiredForTarget(r, r.weights, r.assessments, { [k]: 10 }, 99).kind).toBe('impossible');
    expect(requiredForTarget(r, r.weights, r.assessments, { [k]: 10 }, 50).kind).toBe('guaranteed');
  });
});

describe('expectations-based report (Term Work {65})', () => {
  const r = parseReport(fx('report-expectations.html'))!;

  it('reads tasks and individualized observations into Term Work', () => {
    expect(r.format).toBe('expectations');
    expect(r.assessments.map((a) => a.name)).toEqual(['Observation (2026-10-01)', 'Design Brief', 'Prototype']);
    expect(r.assessments[1]).toMatchObject({ expectation: 'A1.', feedback: 'Clear goals' });
    expect(Object.keys(r.assessments[2].marks)).toEqual(['term']);
  });

  it('uses the {65} term weighting', () => {
    expect(r.weights).toEqual({ term: 65, final: 30, attendance: 5 });
    expect(r.reportedAverages?.term).toBe(91);
  });

  it('computes the course mark from the tasks (the list page said 0.0%)', () => {
    const course = { ...parseCourseList(fx('list.html'))[3], report: r };
    expect(officialMark(course)).toBeCloseTo(91, 6);
  });

  it('maps levels to percentages', () => {
    expect(levelToPercent('4+')).toBe(95);
    expect(levelToPercent('R')).toBe(40);
    expect(levelToPercent('banana')).toBeNull();
  });
});

describe('expectations report laid out with divs instead of tables', () => {
  const r = parseReport(fx('report-expectations-divs.html'))!;

  it('still finds every task, its section, expectation, weight and feedback', () => {
    expect(r.format).toBe('expectations');
    expect(r.assessments.map((a) => [a.name, Object.keys(a.marks)[0]])).toEqual([
      ['Portfolio Check', 'term'],
      ['Design Log', 'term'],
      ['Participation', 'attendance'],
    ]);
    expect(r.assessments[0]).toMatchObject({ expectation: 'B2.', feedback: 'Great sketches' });
    expect(r.assessments[0].marks.term).toMatchObject({ got: 95, outOf: 100, weight: 1 });
    expect(categoryAverages(r, r.assessments).term).toBeCloseTo(97.5, 6);
  });
});

describe('expectations report whose tasks cannot be read', () => {
  it("falls back to TeachAssist's Term Work mark instead of the list page's 0.0%", () => {
    const r = parseReport(fx('report-expectations-unreadable.html'))!;
    const course = { ...parseCourseList(fx('list.html'))[3], report: r };
    expect(course.listMark).toBe(0);
    expect(officialMark(course)).toBe(99.3);
  });
});

describe('average uses final, then current, then midterm marks', () => {
  const courses = parseCourseList(fx('list.html'));
  const finished = parseCourseList(`<table><tr><td>Sample High School - ENG3U1-1 : English<br>Block: P2 - rm. 101</td>
    <td>2026-02-03 ~ 2026-06-26</td><td>FINAL MARK: 93%<br><span>MIDTERM MARK: 88%</span></td></tr></table>`)[0];

  it('reads final marks from the course list', () => {
    expect(finished).toMatchObject({ code: 'ENG3U1-1', final: 93, midterm: 88, listMark: null });
  });

  it('picks the right mark for each course', () => {
    expect(averageMark(finished)).toBe(93);
    expect(averageMark(courses[0])).toBe(91); // night-school Physics: midterm only
    expect(averageMark(courses[2])).toBe(84.2); // current mark wins over the 80% midterm
    expect(averageMark(courses[1])).toBeNull(); // no marks at all
  });

  it('counts midterm-only courses in the semester average', () => {
    const avg = headlineAverage(courses, new Date('2026-11-20T12:00:00'));
    // Physics 91 (midterm), MHF 84.2 (current), TDJ: the list's 0.0% isn't trusted
    // without a readable report, so its 95% midterm counts instead.
    expect(avg.count).toBe(3);
    expect(avg.midterms).toBe(2);
    expect(avg.value).toBeCloseTo((91 + 84.2 + 95) / 3, 6);
  });
});
