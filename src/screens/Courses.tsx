import { fmt, headlineAverage, isActive, officialMark } from '../lib/calc';
import type { Course } from '../lib/types';
import { useStore } from '../store';
import { Icon, MarkRing, SubjectBadge, markColor, timeAgo } from '../components/ui';

const FALLBACK_NAMES: Record<string, string> = {
  TDJ4M: 'Technological Design',
  TDJ3M: 'Technological Design',
  GLC2O: 'Careers',
  CHV2O: 'Civics',
};

export const displayName = (c: Course) => c.name || FALLBACK_NAMES[c.code.slice(0, 5)] || c.code;

const fmtDate = (iso: string) => (iso ? new Date(`${iso}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '');

interface Group {
  key: string;
  label: string;
  courses: Course[];
  order: number;
}

function groupCourses(courses: Course[], now = new Date()): Group[] {
  const map = new Map<string, Group>();
  const today = now.toISOString().slice(0, 10);
  for (const c of courses) {
    const key = `${c.start}~${c.end}`;
    if (!map.has(key)) {
      const status = isActive(c, now) ? 'Now' : c.start > today ? 'Upcoming' : c.end ? 'Past' : '';
      const range = c.start ? `${fmtDate(c.start)} – ${fmtDate(c.end)}` : 'No dates';
      const order = status === 'Now' ? 0 : status === 'Upcoming' ? 1 : 2;
      map.set(key, { key, label: status ? `${status} · ${range}` : range, courses: [], order });
    }
    map.get(key)!.courses.push(c);
  }
  return [...map.values()].sort((a, b) => a.order - b.order || a.key.localeCompare(b.key) * (a.order === 2 ? -1 : 1));
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
      <header className="top">
        <div>
          <h1>Courses</h1>
          <div className="sub">{syncing ? 'Updating…' : `Updated ${timeAgo(snap?.fetchedAt)}`}</div>
        </div>
        <button className={`icon-btn ${syncing ? 'spin' : ''}`} onClick={() => void sync()} aria-label="Refresh" disabled={syncing}>
          <Icon name="refresh" />
        </button>
      </header>

      {syncError && <div className="banner warn">{syncError}</div>}

      <section className="card hero">
        <MarkRing mark={avg.value} size={120} />
        <div className="hero-text">
          <div className="eyebrow">{avg.scope === 'current' ? 'Current average' : 'Overall average'}</div>
          <div className="hero-big" style={{ color: markColor(avg.value) }}>
            {fmt(avg.value)}
            {avg.value !== null && '%'}
          </div>
          <div className="muted small">
            {avg.count} course{avg.count === 1 ? '' : 's'} with a mark
          </div>
        </div>
      </section>

      {groups.map((g) => (
        <section key={g.key}>
          <h3 className="group-label">{g.label}</h3>
          <div className="list">
            {g.courses.map((c) => (
              <CourseRow key={c.id} course={c} onOpen={onOpen} mainSchool={mainSchool} />
            ))}
          </div>
        </section>
      ))}

      {!all.length && !syncing && <div className="empty">No courses yet. Tap refresh to try again.</div>}
    </div>
  );
}

function CourseRow({ course: c, onOpen, mainSchool }: { course: Course; onOpen(id: string): void; mainSchool: string }) {
  const mark = officialMark(c);
  const canOpen = !!c.report || mark !== null || !!c.reportError;
  return (
    <button className="card row" onClick={() => canOpen && onOpen(c.id)} disabled={!canOpen}>
      <SubjectBadge code={c.code} />
      <div className="row-main">
        <div className="row-title">{displayName(c)}</div>
        <div className="row-sub">
          {c.code}
          {c.block && ` · ${c.block}`}
          {c.room && ` · Rm ${c.room}`}
        </div>
        {c.school && c.school !== mainSchool && <div className="row-sub faint">{c.school}</div>}
      </div>
      <div className="row-right">
        {mark !== null ? (
          <div className="row-mark" style={{ color: markColor(mark) }}>
            {fmt(mark)}
            <span className="pct">%</span>
          </div>
        ) : (
          <div className="row-none">No mark</div>
        )}
        {c.midterm !== null && <div className="chip">Midterm {fmt(c.midterm, 0)}%</div>}
      </div>
      {canOpen && (
        <span className="row-chev">
          <Icon name="chevron" size={18} />
        </span>
      )}
    </button>
  );
}
