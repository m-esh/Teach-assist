import { useEffect, type ReactNode } from 'react';
import { fmt } from '../lib/calc';

export function markColor(m: number | null | undefined): string {
  if (m === null || m === undefined) return 'var(--muted)';
  if (m >= 90) return 'var(--g-90)';
  if (m >= 80) return 'var(--g-80)';
  if (m >= 70) return 'var(--g-70)';
  if (m >= 60) return 'var(--g-60)';
  return 'var(--g-50)';
}

const SUBJECT_HUES: Array<[RegExp, string]> = [
  [/^M/, '#ff5a6e'],
  [/^S/, '#30d189'],
  [/^E/, '#ff9f43'],
  [/^I|^ICS/, '#7b6cff'],
  [/^T/, '#3cc8ff'],
  [/^A/, '#c86bff'],
  [/^F/, '#4c8dff'],
  [/^[CH]/, '#ffcf3d'],
  [/^P/, '#2fd6c6'],
  [/^B/, '#f06fb0'],
];

export function subjectColor(code: string): string {
  return SUBJECT_HUES.find(([re]) => re.test(code))?.[1] ?? '#8e8e9a';
}

export function SubjectBadge({ code, size = 44 }: { code: string; size?: number }) {
  const c = subjectColor(code);
  return (
    <div className="subject" style={{ width: size, height: size, background: `linear-gradient(145deg, ${c}, ${c}aa)` }} aria-hidden>
      {code.slice(0, 3)}
    </div>
  );
}

export function MarkRing({ mark, size = 132, label }: { mark: number | null; size?: number; label?: string }) {
  const r = (size - 14) / 2;
  const circ = 2 * Math.PI * r;
  const pct = mark === null ? 0 : Math.max(0, Math.min(100, mark));
  return (
    <div className="ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={r} stroke="var(--ring-track)" strokeWidth="10" fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={markColor(mark)}
          strokeWidth="10"
          strokeLinecap="round"
          fill="none"
          strokeDasharray={circ}
          strokeDashoffset={circ * (1 - pct / 100)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: 'stroke-dashoffset .5s ease, stroke .3s' }}
        />
      </svg>
      <div className="ring-inner">
        <div className="ring-value">
          {mark === null ? '—' : fmt(mark)}
          {mark !== null && <span className="pct">%</span>}
        </div>
        {label && <div className="ring-label">{label}</div>}
      </div>
    </div>
  );
}

export function Delta({ from, to }: { from: number | null | undefined; to: number | null | undefined }) {
  if (from === null || from === undefined || to === null || to === undefined) return null;
  const d = to - from;
  if (Math.abs(d) < 0.05) return <span className="delta flat">±0.0</span>;
  return <span className={`delta ${d > 0 ? 'up' : 'down'}`}>{d > 0 ? '▲' : '▼'} {fmt(Math.abs(d))}</span>;
}

export function Sheet({ open, onClose, title, children }: { open: boolean; onClose(): void; title: string; children: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="sheet-grabber" />
        <div className="sheet-head">
          <h2>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <Icon name="close" />
          </button>
        </div>
        <div className="sheet-body">{children}</div>
      </div>
    </div>
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange(v: boolean): void; label: string }) {
  return (
    <button role="switch" aria-checked={checked} aria-label={label} className={`toggle ${checked ? 'on' : ''}`} onClick={() => onChange(!checked)}>
      <span />
    </button>
  );
}

const PATHS: Record<string, ReactNode> = {
  book: <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5v-15zM4 20.5A2.5 2.5 0 0 1 6.5 18H20v3H6.5A2.5 2.5 0 0 1 4 20.5z" />,
  bell: <path d="M6 16V11a6 6 0 1 1 12 0v5l2 2H4l2-2zM10 20a2 2 0 0 0 4 0" />,
  gear: (
    <>
      <circle cx="12" cy="12" r="3.2" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
    </>
  ),
  back: <path d="M15 5l-7 7 7 7" />,
  chevron: <path d="M9 5l7 7-7 7" />,
  refresh: <path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7" />,
  plus: <path d="M12 5v14M5 12h14" />,
  close: <path d="M6 6l12 12M18 6L6 18" />,
  trash: <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" />,
  undo: <path d="M9 14L4 9l5-5M4 9h10a6 6 0 0 1 0 12h-3" />,
  edit: <path d="M4 20h4L19 9l-4-4L4 16v4zM14 6l4 4" />,
  lock: (
    <>
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </>
  ),
  target: (
    <>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="12" cy="12" r=".8" />
    </>
  ),
  flask: <path d="M12 3v6l-5 9a2 2 0 0 0 1.8 3h6.4a2 2 0 0 0 1.8-3l-5-9V3M9 3h6" />,
  spark: <path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M6 18l2.5-2.5M15.5 8.5L18 6" />,
  chart: <path d="M5 20V10M12 20V4M19 20v-7" />,
  doc: <path d="M7 3h7l5 5v13H7zM14 3v5h5M10 13h6M10 17h6" />,
};

export function Icon({ name, size = 22 }: { name: keyof typeof PATHS | string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {PATHS[name]}
    </svg>
  );
}

export function timeAgo(iso: string | undefined, now = Date.now()): string {
  if (!iso) return 'never';
  const s = Math.max(0, (now - new Date(iso).getTime()) / 1000);
  if (s < 45) return 'just now';
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  const d = Math.round(s / 86400);
  return d === 1 ? 'yesterday' : `${d} days ago`;
}

export function NumberInput({
  value,
  onChange,
  placeholder,
  ariaLabel,
  className,
}: {
  value: string;
  onChange(v: string): void;
  placeholder?: string;
  ariaLabel: string;
  className?: string;
}) {
  return (
    <input
      className={`num ${className ?? ''}`}
      inputMode="decimal"
      enterKeyHint="done"
      value={value}
      placeholder={placeholder}
      aria-label={ariaLabel}
      onChange={(e) => onChange(e.target.value.replace(/[^0-9.]/g, ''))}
    />
  );
}
