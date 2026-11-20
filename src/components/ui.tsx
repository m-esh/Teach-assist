import { useEffect, useRef, useState, type ReactNode } from 'react';
import { fmt } from '../lib/calc';
import { haptic } from '../lib/haptics';

const reducedMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** Animates a number from its previous value (or 0) to the new one. */
export function useCountUp(target: number | null | undefined, ms = 900): number | null {
  const [v, setV] = useState<number | null>(target ?? null);
  const from = useRef<number>(0);
  useEffect(() => {
    if (target === null || target === undefined || !Number.isFinite(target)) {
      setV(null);
      return;
    }
    if (reducedMotion()) {
      setV(target);
      from.current = target;
      return;
    }
    const start = performance.now();
    const a = from.current;
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / ms);
      const e = 1 - Math.pow(1 - t, 3);
      setV(a + (target - a) * e);
      if (t < 1) raf = requestAnimationFrame(tick);
      else from.current = target;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return v;
}

/* ------------------------------------------------------------------ */
/* Top bar: floating glass buttons, title that appears on scroll       */
/* ------------------------------------------------------------------ */

export function NavBar({
  title,
  subtitle,
  left,
  right,
  eyebrow,
}: {
  title: string;
  subtitle?: ReactNode;
  left?: ReactNode;
  right?: ReactNode;
  eyebrow?: ReactNode;
}) {
  const [scrolled, setScrolled] = useState(false);
  const [titled, setTitled] = useState(false);
  useEffect(() => {
    const on = () => {
      setScrolled(window.scrollY > 12);
      setTitled(window.scrollY > 56);
    };
    on();
    window.addEventListener('scroll', on, { passive: true });
    return () => window.removeEventListener('scroll', on);
  }, []);
  return (
    <>
      <div className={`scroll-edge ${scrolled ? 'on' : ''}`} aria-hidden />
      <div className={`topbar ${scrolled ? 'scrolled' : ''} ${titled ? 'titled' : ''}`}>
        <div className="top-side">{left}</div>
        <div className="top-title">{title}</div>
        <div className="top-side right">{right}</div>
      </div>
      <header className="page-head">
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1>{title}</h1>
        {subtitle && <div className="page-sub">{subtitle}</div>}
      </header>
    </>
  );
}

export function GlassButton({
  children,
  onClick,
  label,
  disabled,
  prominent,
  wide,
}: {
  children: ReactNode;
  onClick(): void;
  label: string;
  disabled?: boolean;
  prominent?: boolean;
  wide?: boolean;
}) {
  return (
    <button
      className={`glass-btn ${prominent ? 'prominent' : ''} ${wide ? 'wide' : ''}`}
      onClick={() => {
        haptic('light');
        onClick();
      }}
      disabled={disabled}
      aria-label={label}
    >
      {children}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Cards and rows                                                      */
/* ------------------------------------------------------------------ */

export function Section({
  header,
  footer,
  children,
  className,
  action,
}: {
  header?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  className?: string;
  action?: ReactNode;
}) {
  return (
    <section className={`section ${className ?? ''}`}>
      {(header || action) && (
        <div className="section-header">
          <span>{header}</span>
          {action}
        </div>
      )}
      <div className="card">{children}</div>
      {footer && <div className="section-footer">{footer}</div>}
    </section>
  );
}

export function IconTile({ name, color }: { name: string; color: string }) {
  return (
    <span className="icon-tile" style={{ ['--tile' as string]: color }}>
      <Icon name={name} size={17} />
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Controls                                                            */
/* ------------------------------------------------------------------ */

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange(v: boolean): void; label: string }) {
  return (
    <button role="switch" aria-checked={checked} aria-label={label} className={`toggle ${checked ? 'on' : ''}`} onClick={() => {
        haptic('light');
        onChange(!checked);
      }}>
      <span />
    </button>
  );
}

export function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: Array<[T, string, string?]>; onChange(v: T): void; label: string }) {
  const idx = Math.max(0, options.findIndex(([v]) => v === value));
  return (
    <div className="segmented" role="radiogroup" aria-label={label} style={{ ['--n' as string]: options.length, ['--i' as string]: idx }}>
      <span className="seg-thumb" />
      {options.map(([v, l, icon]) => (
        <button
          key={v}
          role="radio"
          aria-checked={v === value}
          className={v === value ? 'on' : ''}
          onClick={() => {
            if (v !== value) haptic('light');
            onChange(v);
          }}
        >
          {icon && <Icon name={icon} size={16} />}
          {l}
        </button>
      ))}
    </div>
  );
}

export function Stepper({ value, onChange, min = 0, max = 100, step = 1, label }: { value: number; onChange(v: number): void; min?: number; max?: number; step?: number; label: string }) {
  return (
    <div className="stepper" role="group" aria-label={label}>
      <button
        aria-label={`Decrease ${label}`}
        onClick={() => {
          haptic('light');
          onChange(Math.max(min, value - step));
        }}
        disabled={value <= min}
      >
        <Icon name="minus" size={18} />
      </button>
      <button
        aria-label={`Increase ${label}`}
        onClick={() => {
          haptic('light');
          onChange(Math.min(max, value + step));
        }}
        disabled={value >= max}
      >
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
/* Sheets (floating glass, iOS 26 style)                               */
/* ------------------------------------------------------------------ */

export function Sheet({
  onClose,
  title,
  children,
  action,
}: {
  onClose(): void;
  title: string;
  children: ReactNode;
  action?: { label: string; onClick(): void; disabled?: boolean };
}) {
  const [closing, setClosing] = useState(false);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const close = () => {
    if (closing) return;
    setClosing(true);
    setTimeout(() => closeRef.current(), reducedMotion() ? 0 : 220);
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && closeRef.current();
    window.addEventListener('keydown', onKey);
    document.body.classList.add('no-scroll');
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.classList.remove('no-scroll');
    };
  }, []);
  return (
    <div className={`sheet-backdrop ${closing ? 'closing' : ''}`} onClick={close}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <GlassButton onClick={close} label="Close">
            <Icon name="close" size={18} />
          </GlassButton>
          <h2>{title}</h2>
          {action ? (
            <GlassButton onClick={action.onClick} label={action.label} disabled={action.disabled} prominent>
              <Icon name="check" size={20} />
            </GlassButton>
          ) : (
            <span className="glass-btn-space" />
          )}
        </div>
        <div className="sheet-body">{children}</div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Marks & visuals                                                     */
/* ------------------------------------------------------------------ */

export function Ring({ value, size = 180, stroke = 16, children }: { value: number | null; size?: number; stroke?: number; children?: ReactNode }) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const id = requestAnimationFrame(() => setShown(value === null ? 0 : Math.max(0, Math.min(100, value))));
    return () => cancelAnimationFrame(id);
  }, [value]);
  return (
    <div className="ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} stroke="var(--track)" strokeWidth={stroke} fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="var(--accent)"
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={circ}
          strokeDashoffset={circ * (1 - shown / 100)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          className="ring-arc"
        />
      </svg>
      <div className="ring-inner">{children}</div>
    </div>
  );
}

export function MiniRing({ value, size = 34 }: { value: number | null; size?: number }) {
  const stroke = 4;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const pct = value === null ? 0 : Math.max(0, Math.min(100, value));
  return (
    <svg className="mini-ring" width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
      <circle cx={size / 2} cy={size / 2} r={r} stroke="var(--track)" strokeWidth={stroke} fill="none" />
      {value !== null && (
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
        />
      )}
    </svg>
  );
}

export function Mark({ value, digits = 1, className, animate }: { value: number | null | undefined; digits?: number; className?: string; animate?: boolean }) {
  const counted = useCountUp(animate ? value : null);
  const v = animate ? counted : value;
  if (v === null || v === undefined || !Number.isFinite(v)) return <span className={`mark none ${className ?? ''}`}>—</span>;
  return (
    <span className={`mark ${className ?? ''}`}>
      {fmt(v, digits)}
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

/** Bars of evaluation results in order, with the average as a dashed line. */
export function TrendChart({ points }: { points: Array<{ label: string; value: number }> }) {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setOn(true));
    return () => cancelAnimationFrame(id);
  }, []);
  if (!points.length) return null;
  const W = 320;
  const H = 120;
  const gap = points.length > 12 ? 4 : 8;
  const bw = Math.min(34, (W - gap * (points.length - 1)) / points.length);
  const total = bw * points.length + gap * (points.length - 1);
  const x0 = (W - total) / 2;
  const min = Math.max(0, Math.floor((Math.min(...points.map((p) => p.value)) - 15) / 10) * 10);
  const y = (v: number) => H - ((Math.max(min, Math.min(100, v)) - min) / (100 - min)) * (H - 8);
  const avg = points.reduce((s, p) => s + p.value, 0) / points.length;
  return (
    <svg className={`trend ${on ? 'on' : ''}`} viewBox={`0 0 ${W} ${H + 4}`} role="img" aria-label={`Evaluation results, average ${fmt(avg)}%`}>
      {points.map((p, i) => {
        const top = y(p.value);
        return (
          <rect
            key={i}
            x={x0 + i * (bw + gap)}
            y={top}
            width={bw}
            height={H - top}
            rx={Math.min(6, bw / 2)}
            fill="var(--accent)"
            opacity={i === points.length - 1 ? 1 : 0.55}
            style={{ transitionDelay: `${i * 40}ms` }}
          >
            <title>{`${p.label}: ${fmt(p.value)}%`}</title>
          </rect>
        );
      })}
      <line x1="0" x2={W} y1={y(avg)} y2={y(avg)} className="trend-avg" />
    </svg>
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
  close: <path d="M6.5 6.5l11 11M17.5 6.5l-11 11" />,
  trash: <path d="M5 7h14M10 7V4.5h4V7M7 7l.8 12.5h8.4L17 7M10.5 10.5v6M13.5 10.5v6" />,
  undo: <path d="M9 14L4.5 9.5 9 5M4.5 9.5H15a5 5 0 0 1 0 10h-3" />,
  edit: <path d="M4.5 19.5l1-4L16 5a2 2 0 0 1 3 3L8.5 18.5l-4 1z" />,
  wand: <path d="M4 20L15 9M14 4v3M12.5 5.5h3M19 9v3M17.5 10.5h3M18 3.5l1 1M6 6l1 1" />,
  lock: (
    <>
      <rect x="5" y="10.5" width="14" height="10" rx="3" />
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
  wave: <path d="M3 12h2.5l2-5 3 10 3-12 3 9 2-2H21" />,
  faceid: (
    <>
      <path d="M4 8V6.5A2.5 2.5 0 0 1 6.5 4H8M16 4h1.5A2.5 2.5 0 0 1 20 6.5V8M20 16v1.5a2.5 2.5 0 0 1-2.5 2.5H16M8 20H6.5A2.5 2.5 0 0 1 4 17.5V16" />
      <path d="M9 9.5v1M15 9.5v1M12 9.5v3.5h-1M9.5 15.5c1.4 1.2 3.6 1.2 5 0" />
    </>
  ),
  arrowUp: <path d="M12 19V5M6 11l6-6 6 6" />,
  arrowDown: <path d="M12 5v14M6 13l6 6 6-6" />,
  shield: <path d="M12 3l7.5 3v5.5c0 4.5-3.2 8-7.5 9.5-4.3-1.5-7.5-5-7.5-9.5V6z" />,
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4" />
    </>
  ),
  moon: <path d="M19.5 14.5A8 8 0 0 1 9.5 4.5a8 8 0 1 0 10 10z" />,
  auto: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 3.5v17A8.5 8.5 0 0 0 12 3.5z" fill="currentColor" />
    </>
  ),
  /* subjects */
  fx: <path d="M10.5 4.5c-2 0-2.5 1.5-2.8 3.5L6 19.5M4.5 10h6M13 10l6 8M19 10l-6 8" />,
  atom: (
    <>
      <circle cx="12" cy="12" r="1.4" fill="currentColor" />
      <ellipse cx="12" cy="12" rx="9" ry="3.6" />
      <ellipse cx="12" cy="12" rx="9" ry="3.6" transform="rotate(60 12 12)" />
      <ellipse cx="12" cy="12" rx="9" ry="3.6" transform="rotate(120 12 12)" />
    </>
  ),
  flask: <path d="M9.5 3.5h5M10.5 3.5v5.5L5 18.5a1.5 1.5 0 0 0 1.3 2h11.4a1.5 1.5 0 0 0 1.3-2L13.5 9V3.5M7.5 14.5h9" />,
  leaf: <path d="M5 19c0-8 5-13 14-14 0 9-5 14-13 14zM5 19l7-7" />,
  monitor: (
    <>
      <rect x="3.5" y="4.5" width="17" height="11.5" rx="2.5" />
      <path d="M9 20h6M12 16v4M9.5 9l-2 1.5 2 1.5M14.5 9l2 1.5-2 1.5" />
    </>
  ),
  music: <path d="M9 18V6l10-2v12M9 18a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0zM19 16a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0z" />,
  ruler: <path d="M4 15.5L15.5 4 20 8.5 8.5 20zM8 11.5l1.5 1.5M10.5 9l2 2M13 6.5l1.5 1.5M5.5 14l2 2" />,
  globe: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M3.5 12h17M12 3.5c2.5 2.5 3.5 5.5 3.5 8.5s-1 6-3.5 8.5c-2.5-2.5-3.5-5.5-3.5-8.5s1-6 3.5-8.5z" />
    </>
  ),
  speech: <path d="M4.5 6.5a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H11l-4.5 3.5V16.5h0a2 2 0 0 1-2-2z" />,
  run: <path d="M14 5a1.5 1.5 0 1 0 0-.01M10 20l2.5-5.5L15 17v3.5M8 11.5l3-3 3 2 2.5.5M12.5 14.5l-1.5-6" />,
  brief: (
    <>
      <rect x="3.5" y="7.5" width="17" height="12" rx="2.5" />
      <path d="M9 7.5V5.5a1.5 1.5 0 0 1 1.5-1.5h3A1.5 1.5 0 0 1 15 5.5v2M3.5 12.5h17" />
    </>
  ),
  palette: <path d="M12 3.5a8.5 8.5 0 1 0 0 17c1.4 0 2-1 1.4-2.2-.6-1.3.3-2.8 1.8-2.8h1.8a3.5 3.5 0 0 0 3.5-3.5C20.5 7 16.7 3.5 12 3.5zM7.5 12h0M10 7.5h0M15 7.5h0" />,
  pencil: <path d="M5 19l1-4 9.5-9.5 3 3L9 18zM13.5 7.5l3 3" />,
};

export function Icon({ name, size = 22 }: { name: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {PATHS[name]}
    </svg>
  );
}

/* Subject icons: colourful, like app icons, independent of the theme. */
const SUBJECTS: Array<[RegExp, string, string, string]> = [
  [/^M/, 'fx', '#ff6b6b', '#ff3b5c'],
  [/^SPH/, 'atom', '#5ac8fa', '#2f7bff'],
  [/^SCH/, 'flask', '#34d399', '#0ea56b'],
  [/^S(BI|NC)|^S/, 'leaf', '#7ad957', '#2fae4e'],
  [/^IC|^TEJ|^ICS/, 'monitor', '#8b7bff', '#5b4bf0'],
  [/^E/, 'book', '#ffb547', '#ff8a1f'],
  [/^A(MI|MU|MR|MG|MV)/, 'music', '#ff7ac6', '#e0479e'],
  [/^A/, 'palette', '#ff9fd1', '#d9549a'],
  [/^T/, 'ruler', '#4fd1c5', '#1aa3a0'],
  [/^F/, 'speech', '#60a5fa', '#2563eb'],
  [/^[CH]/, 'globe', '#fbbf24', '#e0951a'],
  [/^P/, 'run', '#2dd4bf', '#0f9f8f'],
  [/^B/, 'brief', '#a78bfa', '#7c5ce0'],
  [/^G/, 'brief', '#a3a3ad', '#6e6e78'],
];

export function SubjectIcon({ code, size = 46 }: { code: string; size?: number }) {
  const c = code.toUpperCase();
  const isHall = /^SHAL/.test(c);
  const [, icon, a, b] = isHall ? [null, 'clock', '#a3a3ad', '#6e6e78'] : SUBJECTS.find(([re]) => re.test(c)) ?? [null, 'book', '#a3a3ad', '#6e6e78'];
  return (
    <span className="subject" style={{ width: size, height: size, background: `linear-gradient(150deg, ${a}, ${b})` }} aria-hidden>
      <Icon name={icon as string} size={Math.round(size * 0.5)} />
    </span>
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
