import { useEffect, useState } from 'react';
import type { Update } from '../lib/types';
import { useStore } from '../store';
import { Delta, GlassButton, Icon, Mark, NavBar, Section } from '../components/ui';

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
      <NavBar
        title="Updates"
        subtitle={vault.updates.length ? `${vault.updates.length} change${vault.updates.length === 1 ? '' : 's'} from TeachAssist` : undefined}
        right={
          vault.updates.length ? (
            <GlassButton onClick={clearUpdates} label="Clear all" wide>
              Clear
            </GlassButton>
          ) : undefined
        }
      />
      {!vault.updates.length && (
        <div className="empty big-empty">
          <span className="empty-icon">
            <Icon name="bell" size={28} />
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
              <button key={u.id} className="row update-row" onClick={() => canOpen && onOpen(u.courseId!)} disabled={!canOpen}>
                <span className="update-icon">
                  <Icon name={ICONS[u.type]} size={17} />
                  {fresh.has(u.id) && <span className="dot" aria-label="new" />}
                </span>
                <span className="row-main">
                  <span className="row-title">{u.subtitle}</span>
                  <span className="row-sub">{u.title}</span>
                </span>
                <span className="row-end">
                  {u.to !== undefined && u.to !== null && <Mark value={u.to} className="row-mark" />}
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
