import { useEffect, useState } from 'react';
import { fmt } from '../lib/calc';
import type { Update } from '../lib/types';
import { useStore } from '../store';
import { Delta, Icon, markColor } from '../components/ui';

const ICONS: Record<Update['type'], { icon: string; color: string }> = {
  'evaluation-added': { icon: 'doc', color: '#30d189' },
  'evaluation-changed': { icon: 'edit', color: '#3cc8ff' },
  'mark-changed': { icon: 'chart', color: '#4c8dff' },
  'course-added': { icon: 'plus', color: '#30d189' },
  'average-changed': { icon: 'chart', color: '#2fd6c6' },
  'midterm-added': { icon: 'spark', color: '#ff9f43' },
};

function dayLabel(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const y = new Date();
  y.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === y.toDateString()) return 'Yesterday';
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

export function UpdatesScreen({ onOpen }: { onOpen(id: string): void }) {
  const { vault, markUpdatesSeen, courseById } = useStore();
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
      <header className="top">
        <div>
          <h1>Updates</h1>
          <div className="sub">Changes found each time the app syncs</div>
        </div>
      </header>
      {!vault.updates.length && (
        <div className="empty">
          <Icon name="bell" size={32} />
          <p>Nothing yet. When a new mark shows up on TeachAssist, it'll appear here.</p>
        </div>
      )}
      {groups.map(([label, ups]) => (
        <section key={label}>
          <h3 className="group-label">{label}</h3>
          <div className="list">
            {ups.map((u) => {
              const { icon, color } = ICONS[u.type];
              const canOpen = !!u.courseId && !!courseById(u.courseId);
              return (
                <button key={u.id} className="card row update" onClick={() => canOpen && onOpen(u.courseId!)} disabled={!canOpen}>
                  <div className="update-icon" style={{ background: color }}>
                    <Icon name={icon} size={20} />
                  </div>
                  <div className="row-main">
                    <div className="row-title">
                      {fresh.has(u.id) && <span className="dot" aria-label="new" />}
                      {u.title}
                    </div>
                    <div className="row-sub">{u.subtitle}</div>
                    {u.from !== undefined && u.from !== null ? (
                      <div className="update-vals">
                        <span className="faint">{fmt(u.from)}%</span> → <b style={{ color: markColor(u.to) }}>{fmt(u.to)}%</b>
                      </div>
                    ) : u.to !== undefined && u.to !== null ? (
                      <div className="update-vals">
                        <b style={{ color: markColor(u.to) }}>{fmt(u.to)}%</b>
                      </div>
                    ) : null}
                  </div>
                  <div className="row-right">
                    <Delta from={u.from} to={u.to} />
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
