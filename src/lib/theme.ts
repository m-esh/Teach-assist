/**
 * Look & feel. Stored outside the encrypted vault (it isn't sensitive) so the
 * lock screen can already use your colours.
 */
export const THEMES = {
  purple: { name: 'Purple', dark: '#bf5af2', light: '#af52de' },
  indigo: { name: 'Indigo', dark: '#5e5ce6', light: '#5856d6' },
  blue: { name: 'Blue', dark: '#0a84ff', light: '#007aff' },
  teal: { name: 'Teal', dark: '#40c8e0', light: '#30b0c7' },
  green: { name: 'Green', dark: '#30d158', light: '#28a745' },
  orange: { name: 'Orange', dark: '#ff9f0a', light: '#f08c00' },
  pink: { name: 'Pink', dark: '#ff375f', light: '#ff2d55' },
  brown: { name: 'Brown', dark: '#ac8e68', light: '#9a7650' },
  graphite: { name: 'Graphite', dark: '#98989d', light: '#6e6e73' },
  rainbow: { name: 'Rainbow', dark: '#ff6b8e', light: '#e6264f' },
} as const;

export type ThemeName = keyof typeof THEMES;
export type Appearance = 'system' | 'dark' | 'light';

export interface Look {
  theme: ThemeName;
  appearance: Appearance;
  haptics: boolean;
}

const KEY = 'ta.look';
export const DEFAULT_LOOK: Look = { theme: 'purple', appearance: 'system', haptics: true };

export function loadLook(): Look {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<Look>;
    return {
      theme: v.theme && v.theme in THEMES ? v.theme : DEFAULT_LOOK.theme,
      appearance: v.appearance === 'dark' || v.appearance === 'light' ? v.appearance : 'system',
      haptics: v.haptics !== false,
    };
  } catch {
    return DEFAULT_LOOK;
  }
}

export function saveLook(look: Look) {
  try {
    localStorage.setItem(KEY, JSON.stringify(look));
  } catch {
    /* ignore */
  }
  applyLook(look);
}

export function applyLook(look: Look) {
  const root = document.documentElement;
  root.dataset.theme = look.theme;
  root.dataset.appearance = look.appearance;
  const dark = look.appearance === 'dark' || (look.appearance === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#000000' : '#f2f2f7');
}
