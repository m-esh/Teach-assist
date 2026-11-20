import { describe, expect, it } from 'vitest';
import { diffSnapshots } from '../src/lib/updates';
import type { Course, Snapshot } from '../src/lib/types';

const course = (over: Partial<Course> = {}): Course => ({
  id: '1',
  code: 'MHF4U1-5',
  name: 'Advanced Functions',
  school: '',
  block: 'P3',
  room: '243',
  start: '',
  end: '',
  listMark: 80,
  midterm: null,
  report: {
    format: 'grid',
    categories: [{ key: 'term', label: 'Term', short: 'T' }],
    weights: { term: 100 },
    weightSource: 'estimated',
    assessments: [{ id: 'a', name: 'Unit 1', marks: { term: { got: 8, outOf: 10, weight: 1 } } }],
  },
  ...over,
});

const snap = (courses: Course[]): Snapshot => ({ fetchedAt: '', studentId: '1', courses });

describe('updates feed', () => {
  it('is empty on first sync', () => {
    expect(diffSnapshots(undefined, snap([course()]))).toEqual([]);
  });

  it('reports a new evaluation, the mark change and the average change', () => {
    const before = course();
    const after = course();
    after.report = {
      ...after.report!,
      assessments: [...after.report!.assessments, { id: 'b', name: 'Unit 2', marks: { term: { got: 10, outOf: 10, weight: 1 } } }],
    };
    const ups = diffSnapshots(snap([before]), snap([after]));
    expect(ups.map((u) => u.type)).toEqual(['evaluation-added', 'mark-changed', 'average-changed']);
    expect(ups[0].to).toBe(100);
    expect(ups[1]).toMatchObject({ from: 80, to: 90 });
  });

  it('reports new courses and midterms', () => {
    const ups = diffSnapshots(snap([course()]), snap([course({ midterm: 88 }), course({ id: '2', code: 'ENG4U1-9', report: undefined })]));
    expect(ups.map((u) => u.type)).toContain('midterm-added');
    expect(ups.map((u) => u.type)).toContain('course-added');
  });
});
