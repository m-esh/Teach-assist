/**
 * Haptic feedback for a web app.
 *
 * iPhone: Safari has no vibration API, but since iOS 18 toggling a native
 * `<input type="checkbox" switch>` plays the system haptic tick. We keep one
 * hidden switch and flip it. It must happen inside a tap handler, which is
 * where all calls come from.
 * Android: the standard Vibration API.
 */
import { loadLook } from './theme';

export type Haptic = 'light' | 'medium' | 'error' | 'success';

let label: HTMLLabelElement | null = null;

function hiddenSwitch(): HTMLLabelElement {
  if (label && label.isConnected) return label;
  const l = document.createElement('label');
  l.setAttribute('aria-hidden', 'true');
  l.style.cssText = 'position:fixed;left:-200px;top:0;width:1px;height:1px;overflow:hidden;opacity:0;pointer-events:none;';
  const input = document.createElement('input');
  input.type = 'checkbox';
  input.setAttribute('switch', '');
  input.tabIndex = -1;
  l.appendChild(input);
  document.body.appendChild(l);
  label = l;
  return l;
}

const PATTERNS: Record<Haptic, number | number[]> = {
  light: 8,
  medium: 16,
  success: [10, 50, 10],
  error: [18, 70, 18],
};

export function haptic(kind: Haptic = 'light') {
  try {
    if (!loadLook().haptics) return;
    if (typeof navigator.vibrate === 'function') {
      navigator.vibrate(PATTERNS[kind]);
      return;
    }
    const l = hiddenSwitch();
    l.click();
    if (kind === 'error' || kind === 'success') setTimeout(() => l.click(), kind === 'error' ? 110 : 80);
  } catch {
    /* haptics are a nicety */
  }
}
