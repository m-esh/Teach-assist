import { useEffect, useState, type ReactNode } from 'react';
import { fmt } from '../lib/calc';

/* ------------------------------------------------------------------ */
/* Navigation bar: large title that collapses into a blurred bar        */
/* ------------------------------------------------------------------ */

export function NavBar({
  title,
  subtitle,
  large = true,
  left,
  right,
}: {
  title: string;
  subtitle?: ReactNode;
  large?: boolean;
  left?: ReactNode;
  right?: ReactNode;
}) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > (large ? 40 : 4));
    on();
    window.addEventListener('scroll', on, { passive: true });
    return () => window.removeEventListener('scroll', on);
  }, [large]);
  return (
    <>
      <div className={`navbar ${scrolled ? 'scrolled' : ''}`}>
        <div className="nav-side">{left}</div>
        <div className={`nav-title ${large && !scrolled ? 'hide' : ''}`}>{title}</div>
        <div className="nav-side right">{right}</div>
      </div>
      {large && (
        <div className="large-title">
          <h1>{title}</h1>
          {subtitle && <div className="large-sub">{subtitle}</div>}
        </div>
      )}
    </>
  );
}

export function NavButton({ children, onClick, bold, disabled, label }: { children: ReactNode; onClick(): void; bold?: boolean; disabled?: boolean; label?: string }) {
  return (
    <button className={`nav-btn ${bold ? 'bold' : ''}`} onClick={onClick} disabled={disabled} aria-label={label}>
      {children}
    </button>
  );
}

export function BackButton({ onClick, label }: { onClick(): void; label: string }) {
  return (
    <button className="nav-btn back" onClick={onClick} aria-label="Back">
      <Icon name="back" size={24} />
      <span>{label}</span>
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Inset grouped lists                                                 */
/* ------------------------------------------------------------------ */

export function Section({ header, footer, children, className }: { header?: ReactNode; footer?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`section ${className ?? ''}`}>
      {header && <div className="section-header">{header}</div>}
      <div className="group">{children}</div>
      {footer && <div className="section-footer">{footer}</div>}
    </section>
  );
}

export function IconTile({ name, color }: { name: string; color?: string }) {
  return (
    <span className="icon-tile" style={color ? { background: color } : undefined}>
      <Icon name={name} size={17} />
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Controls                                                            */
/* ------------------------------------------------------------------ */

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange(v: boolean): void; label: string }) {
  return (
    <button role="switch" aria-checked={checked} aria-label={label} className={`toggle ${checked ? 'on' : ''}`} onClick={() => onChange(!checked)}>
      <span />
    </button>
  );
}

export function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: Array<[T, string]>; onChange(v: T): void; label: string }) {
  const idx = Math.max(0, options.findIndex(([v]) => v === value));
  return (
    <div className="segmented" role="radiogroup" aria-label={label} style={{ ['--n' as string]: options.length, ['--i' as string]: idx }}>
      <span className="seg-thumb" />
      {options.map(([v, l]) => (
        <button key={v} role="radio" aria-checked={v === value} className={v === value ? 'on' : ''} onClick={() => onChange(v)}>
          {l}
        </button>
      ))}
    </div>
  );
}

export function Stepper({ value, onChange, min = 0, max = 100, step = 1, label }: { value: number; onChange(v: number): void; min?: number; max?: number; step?: number; label: string }) {
  return (
    <div className="stepper" role="group" aria-label={label}>
      <button aria-label={`Decrease ${label}`} onClick={() => onChange(Math.max(min, value - step))} disabled={value <= min}>
        <Icon name="minus" size={18} />
      </button>
      <span className="stepper-sep" />
      <button aria-label={`Increase ${label}`} onClick={() => onChange(Math.min(max, value + step))} disabled={value >= max}>
        <Icon name="plus" size={18} />
      </button>
    </div>
  );
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
      onFocus={(e) => e.target.select()}
      onChange={(e) => onChange(e.target.value.replace(/[^0-9.]/g, ''))}
    />
  );
}

/* ------------------------------------------------------------------ */
/* Sheets                                                              */
/* ------------------------------------------------------------------ */

export function Sheet({
  open,
  onClose,
  title,
  children,
  action,
}: {
  open: boolean;
  onClose(): void;
  title: string;
  children: ReactNode;
  action?: { label: string; onClick(): void; disabled?: boolean };
}) {
  const [closing, setClosing] = useState(false);
  useEffect(() => {
    if (!open) return;
    setClosing(false);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    document.body.classList.add('no-scroll');
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.classList.remove('no-scroll');
    };
  }, [open, onClose]);
  if (!open) return null;
  const close = () => {
    setClosing(true);
    setTimeout(onClose, 180);
  };
  return (
    <div className={`sheet-backdrop ${closing ? 'closing' : ''}`} onClick={close}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="sheet-grabber" />
        <div className="sheet-head">
          <button className="nav-btn" onClick={close}>
            {action ? 'Cancel' : ''}
          </button>
          <h2>{title}</h2>
          {action ? (
            <button className="nav-btn bold" onClick={action.onClick} disabled={action.disabled}>
              {action.label}
            </button>
          ) : (
            <button className="nav-btn bold" onClick={close}>
              Done
            </button>
          )}
        </div>
        <div className="sheet-body">{children}</div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Marks                                                               */
/* ------------------------------------------------------------------ */

export function MarkRing({ mark, size = 160, stroke = 14, children }: { mark: number | null; size?: number; stroke?: number; children?: ReactNode }) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const pct = mark === null ? 0 : Math.max(0, Math.min(100, mark));
  return (
    <div className="ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} stroke="var(--fill)" strokeWidth={stroke} fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="var(--accent)"
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={circ}
          strokeDashoffset={circ * (1 - pct / 100)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          className="ring-arc"
        />
      </svg>
      <div className="ring-inner">{children}</div>
    </div>
  );
}

export function Mark({ value, digits = 1, className }: { value: number | null | undefined; digits?: number; className?: string }) {
  if (value === null || value === undefined || !Number.isFinite(value)) return <span className={`mark none ${className ?? ''}`}>—</span>;
  return (
    <span className={`mark ${className ?? ''}`}>
      {fmt(value, digits)}
      <span className="pct">%</span>
    </span>
  );
}

export function Delta({ from, to }: { from: number | null | undefined; to: number | null | undefined }) {
  if (from === null || from === undefined || to === null || to === undefined) return null;
  const d = to - from;
  if (Math.abs(d) < 0.05) return <span className="delta flat">0.0</span>;
  return (
    <span className={`delta ${d > 0 ? 'up' : 'down'}`}>
      <Icon name={d > 0 ? 'arrowUp' : 'arrowDown'} size={11} />
      {fmt(Math.abs(d))}
    </span>
  );
}

export function SubjectBadge({ code }: { code: string }) {
  return (
    <span className="subject" aria-hidden>
      {code.slice(0, 3)}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Icons (SF Symbols-like strokes)                                     */
/* ------------------------------------------------------------------ */

const PATHS: Record<string, ReactNode> = {
  book: <path d="M12 6.5C10 5 7 4.5 4 5v13c3-.5 6 0 8 1.5M12 6.5c2-1.5 5-2 8-1.5v13c-3-.5-6 0-8 1.5M12 6.5v13" />,
  bell: <path d="M6 16.5V11a6 6 0 1 1 12 0v5.5l1.5 1.5h-15L6 16.5zM10 20.5a2 2 0 0 0 4 0" />,
  gear: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2.8l1.6 2.3 2.7-.7.6 2.7 2.6 1-1 2.6 1.7 2.2-2.3 1.6.3 2.8-2.8.2-1.1 2.6-2.5-1.3-2.5 1.3-1.1-2.6-2.8-.2.3-2.8-2.3-1.6 1.7-2.2-1-2.6 2.6-1 .6-2.7 2.7.7z" />
    </>
  ),
  back: <path d="M15 4.5L7.5 12l7.5 7.5" />,
  chevron: <path d="M9.5 5.5L16 12l-6.5 6.5" />,
  refresh: <path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3M19.5 4.5v4.8h-4.8" />,
  plus: <path d="M12 5v14M5 12h14" />,
  minus: <path d="M5 12h14" />,
  close: <path d="M6 6l12 12M18 6L6 18" />,
  trash: <path d="M5 7h14M10 7V4.5h4V7M7 7l.8 12.5h8.4L17 7M10.5 10.5v6M13.5 10.5v6" />,
  undo: <path d="M9 14L4.5 9.5 9 5M4.5 9.5H15a5 5 0 0 1 0 10h-3" />,
  edit: <path d="M4.5 19.5l1-4L16 5a2 2 0 0 1 3 3L8.5 18.5l-4 1z" />,
  lock: (
    <>
      <rect x="5" y="10.5" width="14" height="10" rx="2.5" />
      <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" />
    </>
  ),
  target: (
    <>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="12" cy="12" r="0.6" fill="currentColor" />
    </>
  ),
  doc: <path d="M7 3.5h6.5L18 8v12.5H7zM13 3.5V8h5M9.5 12.5h5M9.5 16h5" />,
  chart: <path d="M5 19.5v-6M10 19.5V9M15 19.5v-8M20 19.5V5" />,
  spark: <path d="M12 3l1.8 5.4L19 10l-5.2 1.6L12 17l-1.8-5.4L5 10l5.2-1.6z" />,
  person: (
    <>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20c1-3.5 4-5 7-5s6 1.5 7 5" />
    </>
  ),
  paint: <path d="M12 3.5a8.5 8.5 0 1 0 0 17c1.4 0 2-1 1.4-2.2-.6-1.3.3-2.8 1.8-2.8h1.8a3.5 3.5 0 0 0 3.5-3.5C20.5 7 16.7 3.5 12 3.5zM7.5 12a1 1 0 1 0 0-.01M10 7.5a1 1 0 1 0 0-.01M15 7.5a1 1 0 1 0 0-.01" />,
  eye: (
    <>
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  key: (
    <>
      <circle cx="8" cy="15" r="4" />
      <path d="M11 12l8.5-8.5M16.5 6.5l2.5 2.5M14.5 8.5l2 2" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </>
  ),
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  arrowUp: <path d="M12 19V5M6 11l6-6 6 6" />,
  arrowDown: <path d="M12 5v14M6 13l6 6 6-6" />,
  shield: <path d="M12 3l7.5 3v5.5c0 4.5-3.2 8-7.5 9.5-4.3-1.5-7.5-5-7.5-9.5V6z" />,
};

export function Icon({ name, size = 22 }: { name: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {PATHS[name]}
    </svg>
  );
}

export function timeAgo(iso: string | undefined, now = Date.now()): string {
  if (!iso) return 'never';
  const s = Math.max(0, (now - new Date(iso).getTime()) / 1000);
  if (s < 45) return 'just now';
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} hr ago`;
  const d = Math.round(s / 86400);
  return d === 1 ? 'yesterday' : `${d} days ago`;
}
