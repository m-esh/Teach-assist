export interface Category {
  key: string;
  label: string;
  short: string;
}

export interface CatMark {
  got: number;
  outOf: number;
  weight: number;
  /** Shown on TeachAssist but not counted (not handed in / No Mark). */
  excluded?: boolean;
  /** Original text, e.g. a level like "4+" */
  raw?: string;
}

export interface Assessment {
  id: string;
  name: string;
  marks: Record<string, CatMark>;
  feedback?: string;
  expectation?: string;
  /** Whole evaluation is not counted by TeachAssist. */
  excluded?: 'not-counted' | 'no-mark';
  hypothetical?: boolean;
}

export type WeightSource = 'teachassist' | 'inferred' | 'estimated' | 'custom';

export interface CourseReport {
  format: 'grid' | 'expectations';
  categories: Category[];
  assessments: Assessment[];
  /** Category key -> course weighting (any scale, normalised when used). */
  weights: Record<string, number>;
  weightSource: WeightSource;
  /** The course mark TeachAssist printed on the report page, if found. */
  reportedMark?: number;
  /** Category averages TeachAssist printed, if found. */
  reportedAverages?: Record<string, number>;
}

export interface Course {
  /** subject_id when available, otherwise "code:<CODE>" */
  id: string;
  code: string;
  name: string;
  school: string;
  block: string;
  room: string;
  start: string;
  end: string;
  listMark: number | null;
  midterm: number | null;
  report?: CourseReport;
  reportError?: string;
}

export interface Snapshot {
  fetchedAt: string;
  studentId: string;
  courses: Course[];
}

export type UpdateType = 'evaluation-added' | 'evaluation-changed' | 'mark-changed' | 'course-added' | 'average-changed' | 'midterm-added';

export interface Update {
  id: string;
  ts: string;
  type: UpdateType;
  courseId?: string;
  title: string;
  subtitle: string;
  from?: number | null;
  to?: number | null;
  seen: boolean;
}
