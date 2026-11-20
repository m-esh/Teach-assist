import { useCallback, useEffect, useLayoutEffect, useRef, type PointerEvent as RPointerEvent } from 'react';
import { HapticTarget, Icon } from './ui';
import { haptic } from '../lib/haptics';

export interface TabDef<T extends string> {
  id: T;
  label: string;
  icon: string;
  badge?: number;
}

/**
 * Floating Liquid Glass tab bar (same feel as Clad): one glass highlight that
 * springs between tabs, and that you can press and drag along the bar like a
 * lens. Past either end it resists and the bar stretches a little.
 */
export function TabBar<T extends string>({ tabs, active, onSelect }: { tabs: TabDef<T>[]; active: T | null; onSelect(id: T): void }) {
  const nav = useRef<HTMLElement>(null);
  const pill = useRef<HTMLSpanElement>(null);
  const items = useRef<Array<HTMLButtonElement | null>>([]);
  const drag = useRef<{ id: number; startX: number; hover: number; moved: boolean } | null>(null);
  const placed = useRef(false);
  const idx = active === null ? -1 : tabs.findIndex((t) => t.id === active);

  const geometry = (i: number) => {
    const el = items.current[i];
    return el ? { x: el.offsetLeft, w: el.offsetWidth } : { x: 0, w: 0 };
  };

  const place = useCallback(
    (i: number, animate: boolean) => {
      const p = pill.current;
      if (!p) return;
      if (i < 0) {
        p.style.opacity = '0';
        return;
      }
      const { x, w } = geometry(i);
      p.classList.toggle('no-anim', !animate);
      p.style.opacity = '1';
      p.style.width = `${w}px`;
      p.style.transform = `translateX(${x}px)`;
      if (!animate) {
        void p.offsetWidth;
        p.classList.remove('no-anim');
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  useLayoutEffect(() => {
    if (drag.current) return;
    place(idx, placed.current);
    placed.current = true;
  }, [idx, place]);

  useEffect(() => {
    const onResize = () => place(idx, false);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [idx, place]);

  const localX = (e: RPointerEvent) => e.clientX - (nav.current?.getBoundingClientRect().left ?? 0);
  const nearest = (x: number) => {
    let best = 0;
    let bd = Infinity;
    items.current.forEach((el, i) => {
      if (!el) return;
      const c = el.offsetLeft + el.offsetWidth / 2;
      if (Math.abs(c - x) < bd) {
        bd = Math.abs(c - x);
        best = i;
      }
    });
    return best;
  };

  const follow = (x: number, initial: boolean) => {
    const p = pill.current;
    const n = nav.current;
    if (!p || !n) return;
    const first = items.current[0]!;
    const last = items.current[items.current.length - 1]!;
    const w = geometry(Math.max(0, idx)).w || first.offsetWidth;
    const min = first.offsetLeft;
    const max = last.offsetLeft + last.offsetWidth - w;
    let left = x - w / 2;
    let over = 0;
    const give = (d: number) => Math.sign(d) * Math.min(10, Math.abs(d) * 0.2);
    if (left < min) {
      over = left - min;
      left = min + give(over);
    }
    if (left > max) {
      over = left - max;
      left = max + give(over);
    }
    p.classList.toggle('tracking', !initial);
    p.style.opacity = '1';
    p.style.width = `${w}px`;
    p.style.transform = `translateX(${left}px)`;
    n.style.setProperty('--stretch', String(1 + Math.min(0.035, Math.abs(over) / 900)));
    n.style.setProperty('--origin', over < 0 ? 'right' : 'left');
    const hover = nearest(x);
    if (drag.current && hover !== drag.current.hover) {
      drag.current.hover = hover;
      haptic('light');
      items.current.forEach((el, i) => el?.classList.toggle('hover', i === hover));
    }
  };

  const end = () => {
    pill.current?.classList.remove('lens', 'tracking');
    nav.current?.classList.remove('dragging');
    nav.current?.style.setProperty('--stretch', '1');
    items.current.forEach((el) => el?.classList.remove('hover'));
    drag.current = null;
  };

  const onDown = (e: RPointerEvent) => {
    if (e.button !== 0) return;
    // Capture the pointer only once a drag starts, so a plain tap reaches the
    // tab itself (needed for the iPhone haptic layer).
    drag.current = { id: e.pointerId, startX: e.clientX, hover: idx, moved: false };
    pill.current?.classList.add('lens');
    nav.current?.classList.add('dragging');
    follow(localX(e), true);
  };
  const onMove = (e: RPointerEvent) => {
    if (!drag.current || e.pointerId !== drag.current.id) return;
    if (!drag.current.moved && Math.abs(e.clientX - drag.current.startX) > 6) {
      drag.current.moved = true;
      try {
        nav.current?.setPointerCapture(e.pointerId);
      } catch {
        /* pointer already released */
      }
    }
    follow(localX(e), false);
  };
  const onUp = (e: RPointerEvent) => {
    if (!drag.current || e.pointerId !== drag.current.id) return;
    const target = nearest(localX(e));
    end();
    if (target === idx) place(idx, true);
    onSelect(tabs[target].id);
  };
  const onCancel = () => {
    if (!drag.current) return;
    end();
    place(idx, true);
  };

  return (
    <nav
      ref={nav}
      className="tabbar"
      aria-label="Sections"
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onCancel}
    >
      <span ref={pill} className="tab-pill" aria-hidden />
      {tabs.map((t, i) => (
        <button
          key={t.id}
          ref={(el) => {
            items.current[i] = el;
          }}
          className={`tab ${i === idx ? 'active' : ''}`}
          aria-current={i === idx ? 'page' : undefined}
          aria-label={t.label}
          onClick={(e) => {
            // Pointer handlers already navigated; keep keyboard activation working.
            if (e.detail === 0) onSelect(t.id);
          }}
        >
          <span className="tab-icon">
            <Icon name={t.icon} size={24} />
            {!!t.badge && <span className="badge">{t.badge > 99 ? '99+' : t.badge}</span>}
          </span>
          <span className="tab-label">{t.label}</span>
          <HapticTarget />
        </button>
      ))}
    </nav>
  );
}
