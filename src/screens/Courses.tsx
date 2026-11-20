import { headlineAverage, isActive, officialMark } from '../lib/calc';
import type { Course } from '../lib/types';
import { useStore } from '../store';
import { Icon, Mark, NavBar, NavButton, Section, SubjectBadge, timeAgo } from '../components/ui';

const FALLBACK_NAMES: Record<string, string> = {
  TDJ4M: 'Technological Design',
  TDJ3M: 'Technological Design',
  GLC2O: 'Careers',
  CHV2O: 'Civics',
};

export const displayName = (c: Course) => c.name || FALLBACK_NAMES[c.code.slice(0, 5)] || c.code;

const fmtDate = (iso: string) => (iso ? new Date(`${iso}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '');

interface Group {
  key: string;
  title: string;
  range: string;
  courses: Course[];
  order: number;
}

function groupCourses(courses: Course[], now = new Date()): Group[] {
  const map = new Map<string, Group>();
  const today = now.toISOString().slice(0, 10);
  for (const c of courses) {
    const key = `${c.start}~${c.end}`;
    if (!map.has(key)) {
      const status = isActive(c, now) ? 'Current' : c.start > today ? 'Upcoming' : c.end ? 'Past' : 'Other';
      const order = { Current: 0, Upcoming: 1, Past: 2, Other: 3 }[status];
      map.set(key, { key, title: status, range: c.start ? `${fmtDate(c.start)} – ${fmtDate(c.end)}` : '', courses: [], order });
    }
    map.get(key)!.courses.push(c);
  }
  return [...map.values()].sort((a, b) => a.order - b.order || (a.order === 2 ? b.key.localeCompare(a.key) : a.key.localeCompare(b.key)));
}

export function CoursesScreen({ onOpen }: { onOpen(id: string): void }) {
  const { vault, syncing, syncError, sync } = useStore();
  const snap = vault.snapshot;
  const all = snap?.courses ?? [];
  const courses = vault.settings.hideEmptyCourses ? all.filter((c) => officialMark(c) !== null || c.midterm !== null) : all;
  const avg = headlineAverage(all);
  const groups = groupCourses(courses);
  const schoolCounts = new Map<string, number>();
  for (const c of all) schoolCounts.set(c.school, (schoolCounts.get(c.school) ?? 0) + 1);
  const mainSchool = [...schoolCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? '';

  return (
    <div className="screen">
      <NavBar
        title="Courses"
        subtitle={syncing ? 'Updating…' : `Updated ${timeAgo(snap?.fetchedAt)}`}
        right={
          <NavButton onClick={() => void sync()} disabled={syncing} label="Refresh">
            <span className={syncing ? 'spin' : ''}>
              <Icon name="refresh" size={22} />
            </span>
          </NavButton>
        }
      />

      {syncError && (
        <div className="notice">
          <Icon name="clock" size={16} />
          <span>{syncError}</span>
        </div>
      )}

      <div className="summary">
        <div className="summary-label">{avg.scope === 'current' ? 'Current Average' : 'Average'}</div>
        <Mark value={avg.value} className="summary-mark" />
        <div className="summary-bar" aria-hidden>
          <div style={{ width: `${Math.max(0, Math.min(100, avg.value ?? 0))}%` }} />
        </div>
        <div className="summary-foot">
          {avg.count} course{avg.count === 1 ? '' : 's'} with a mark
        </div>
      </div>

      {groups.map((g) => (
        <Section
          key={g.key}
          header={
            <>
              <span>{g.title}</span>
              {g.range && <span className="header-aside">{g.range}</span>}
            </>
          }
        >
          {g.courses.map((c) => (
            <CourseCell key={c.id} course={c} onOpen={onOpen} mainSchool={mainSchool} />
          ))}
        </Section>
      ))}

      {!all.length && !syncing && <div className="empty">No courses yet.</div>}
    </div>
  );
}

function CourseCell({ course: c, onOpen, mainSchool }: { course: Course; onOpen(id: string): void; mainSchool: string }) {
  const mark = officialMark(c);
  const canOpen = !!c.report || mark !== null || !!c.reportError;
  const details = [c.code, c.block && `Block ${c.block}`, c.room && `Rm ${c.room}`].filter(Boolean).join(' · ');
  return (
    <button className="cell course-cell" onClick={() => canOpen && onOpen(c.id)} disabled={!canOpen}>
      <SubjectBadge code={c.code} />
      <span className="cell-main">
        <span className="cell-title">{displayName(c)}</span>
        <span className="cell-sub">{details}</span>
        {c.school && c.school !== mainSchool && <span className="cell-sub">{c.school}</span>}
      </span>
      <span className="cell-end">
        {mark !== null ? <Mark value={mark} className="cell-mark" /> : <span className="cell-none">No mark</span>}
        {c.midterm !== null && <span className="cell-midterm">Midterm {Math.round(c.midterm)}%</span>}
      </span>
      {canOpen ? (
        <span className="chev">
          <Icon name="chevron" size={16} />
        </span>
      ) : (
        <span className="chev-space" />
      )}
    </button>
  );
}
