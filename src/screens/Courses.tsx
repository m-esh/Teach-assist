import { fmt, headlineAverage, isActive, officialMark } from '../lib/calc';
import type { Course } from '../lib/types';
import { useStore } from '../store';
import { GlassButton, Icon, Mark, NavBar, Ring, Section, SubjectIcon, timeAgo } from '../components/ui';

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
      const status = isActive(c, now) ? 'This Semester' : c.start > today ? 'Next Semester' : c.end ? 'Past' : 'Other';
      const order = { 'This Semester': 0, 'Next Semester': 1, Past: 2, Other: 3 }[status];
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
        subtitle={syncing ? 'Checking TeachAssist…' : `Updated ${timeAgo(snap?.fetchedAt)}`}
        right={
          <GlassButton onClick={() => void sync()} disabled={syncing} label="Refresh">
            <span className={syncing ? 'spin' : ''}>
              <Icon name="refresh" size={20} />
            </span>
          </GlassButton>
        }
      />

      {syncError && (
        <div className="notice">
          <Icon name="clock" size={18} />
          <span>{syncError}</span>
        </div>
      )}

      <section className="hero-card">
        <Ring value={avg.value} size={176} stroke={14}>
          <Mark value={avg.value} animate className="ring-mark" />
          <span className="ring-caption">{avg.scope === 'current' ? 'Average' : 'Overall'}</span>
        </Ring>
        <div className="hero-note">
          {avg.count} course{avg.count === 1 ? '' : 's'} with a mark{avg.scope === 'current' ? ' this semester' : ''}
        </div>
      </section>

      {groups.map((g) => (
        <Section key={g.key} header={g.title} action={g.range ? <span className="header-aside">{g.range}</span> : undefined}>
          {g.courses.map((c, i) => (
            <CourseRow key={c.id} course={c} onOpen={onOpen} mainSchool={mainSchool} index={i} />
          ))}
        </Section>
      ))}

      {!all.length && !syncing && <div className="empty">No courses yet.</div>}
    </div>
  );
}

function CourseRow({ course: c, onOpen, mainSchool, index }: { course: Course; onOpen(id: string): void; mainSchool: string; index: number }) {
  const mark = officialMark(c);
  const canOpen = !!c.report || mark !== null || !!c.reportError;
  const details = [c.block && `Block ${c.block}`, c.room && `Room ${c.room}`].filter(Boolean).join(' · ');
  return (
    <button className="row course-row" onClick={() => canOpen && onOpen(c.id)} disabled={!canOpen} style={{ ['--i' as string]: index }}>
      <SubjectIcon code={c.code} />
      <span className="row-main">
        <span className="row-title">{displayName(c)}</span>
        <span className="row-sub">
          {c.code}
          {details && ` · ${details}`}
        </span>
        {c.school && c.school !== mainSchool && <span className="row-sub faint">{c.school}</span>}
      </span>
      <span className="row-end">
        {mark !== null ? (
          <>
            <Mark value={mark} className="row-mark" />
            <span className="mini-bar">
              <span style={{ width: `${Math.max(0, Math.min(100, mark))}%` }} />
            </span>
          </>
        ) : c.midterm !== null ? (
          <>
            <Mark value={c.midterm} digits={0} className="row-mark soft" />
            <span className="row-tag">Midterm</span>
          </>
        ) : (
          <span className="row-none">No mark</span>
        )}
        {mark !== null && c.midterm !== null && <span className="row-tag">Midterm {fmt(c.midterm, 0)}%</span>}
      </span>
      {canOpen && (
        <span className="chev">
          <Icon name="chevron" size={15} />
        </span>
      )}
    </button>
  );
}
