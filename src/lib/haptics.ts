/**
 * Haptic feedback.
 *
 * iPhone: Safari has no vibration API. Since iOS 18 a native
 * `<input type="checkbox" switch>` plays the system haptic tick when it is
 * toggled by a real tap (programmatic clicks stay silent). So pressable
 * controls render <HapticTarget/>: an invisible label over the control,
 * wired to a hidden switch. Your tap hits the label, the switch flips (tick),
 * and the click still reaches the control as normal.
 *
 * Android: the standard Vibration API via haptic().
 */
import { loadLook } from './theme';

export type Haptic = 'light' | 'medium' | 'error' | 'success';

export const isIOS = () =>
  typeof navigator !== 'undefined' &&
  (/iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));

const PATTERNS: Record<Haptic, number | number[]> = {
  light: 8,
  medium: 16,
  success: [10, 50, 10],
  error: [18, 70, 18],
};

/** Vibration for platforms that support it (Android). iPhone uses HapticTarget. */
export function haptic(kind: Haptic = 'light') {
  try {
    if (!loadLook().haptics || isIOS() || typeof navigator.vibrate !== 'function') return;
    navigator.vibrate(PATTERNS[kind]);
  } catch {
    /* haptics are a nicety */
  }
}

/** Reflects the Haptics setting on <html> so the iPhone tap layers can be turned off. */
export function applyHapticsSetting(on: boolean) {
  document.documentElement.dataset.haptics = on ? 'on' : 'off';
}
