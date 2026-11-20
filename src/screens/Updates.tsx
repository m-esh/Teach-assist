import { useEffect, useState } from 'react';
import type { Update } from '../lib/types';
import { useStore } from '../store';
import { Delta, Icon, Mark, NavBar, NavButton, Section } from '../components/ui';

const ICONS: Record<Update['type'], string> = {
  'evaluation-added': 'doc',
  'evaluation-changed': 'edit',
  'mark-changed': 'chart',
  'course-added': 'plus',
  'average-changed': 'chart',
  'midterm-added': 'spark',
};

function dayLabel(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const y = new Date();
  y.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === y.toDateString()) return 'Yesterday';
  return d.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
}

export function UpdatesScreen({ onOpen }: { onOpen(id: string): void }) {
  const { vault, markUpdatesSeen, courseById, clearUpdates } = useStore();
  // Remember which were new when the screen opened, so the dots stay visible while reading.
  const [fresh] = useState(() => new Set(vault.updates.filter((u) => !u.seen).map((u) => u.id)));
  useEffect(() => {
    markUpdatesSeen();
  }, [markUpdatesSeen]);

  const groups: Array<[string, Update[]]> = [];
  for (const u of vault.updates) {
    const label = dayLabel(u.ts);
    const g = groups.find(([l]) => l === label);
    if (g) g[1].push(u);
    else groups.push([label, [u]]);
  }

  return (
    <div className="screen">
      <NavBar title="Updates" right={vault.updates.length ? <NavButton onClick={clearUpdates}>Clear</NavButton> : undefined} />
      {!vault.updates.length && (
        <div className="empty big-empty">
          <span className="empty-icon">
            <Icon name="bell" size={30} />
          </span>
          <div className="empty-title">No Updates Yet</div>
          <div className="empty-text">New marks and changes from TeachAssist will show up here.</div>
        </div>
      )}
      {groups.map(([label, ups]) => (
        <Section key={label} header={label}>
          {ups.map((u) => {
            const canOpen = !!u.courseId && !!courseById(u.courseId);
            return (
              <button key={u.id} className="cell update-cell" onClick={() => canOpen && onOpen(u.courseId!)} disabled={!canOpen}>
                <span className="update-icon">
                  <Icon name={ICONS[u.type]} size={17} />
                  {fresh.has(u.id) && <span className="dot" aria-label="new" />}
                </span>
                <span className="cell-main">
                  <span className="cell-title">{u.subtitle}</span>
                  <span className="cell-sub">{u.title}</span>
                </span>
                <span className="cell-end">
                  {u.to !== undefined && u.to !== null && <Mark value={u.to} className="cell-mark" />}
                  {u.from !== undefined && u.from !== null && <Delta from={u.from} to={u.to} />}
                </span>
              </button>
            );
          })}
        </Section>
      ))}
    </div>
  );
}
