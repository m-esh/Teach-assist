/**
 * Everything the app knows lives in one "vault" in this device's browser
 * storage. Nothing is sent anywhere except the login going to TeachAssist
 * through the relay.
 *
 * With a PIN set, the vault is encrypted with AES-GCM using a key derived from
 * the PIN (PBKDF2-SHA256, 310k iterations). Ten wrong PINs erase the vault.
 */
import type { Snapshot, Update } from './types';

export interface Settings {
  autoRefresh: boolean;
  hideEmptyCourses: boolean;
  relayKey: string;
}

export interface Vault {
  creds?: { username: string; password: string };
  snapshot?: Snapshot;
  updates: Update[];
  settings: Settings;
  /** course code -> category key -> weight (user corrections) */
  weightOverrides: Record<string, Record<string, number>>;
  /** course code -> saved "What do I need?" setup */
  neededPlans: Record<string, NeededPlan>;
}

export interface NeededPlan {
  target: number;
  /** Regular evaluations still to come. */
  left: number;
  /** Weight of each remaining evaluation, per category. */
  weights: Record<string, number>;
  /** Whether a final exam/culminating task is still to come. */
  final: boolean;
}

export const DEFAULT_SETTINGS: Settings = { autoRefresh: true, hideEmptyCourses: false, relayKey: '' };

export const emptyVault = (): Vault => ({ updates: [], settings: { ...DEFAULT_SETTINGS }, weightOverrides: {}, neededPlans: {} });

const KEY = 'ta.vault.v1';
const FAILS = 'ta.pinFails';
const MAX_FAILS = 10;
const ITERATIONS = 310_000;

interface PlainBlob {
  enc: false;
  data: Vault;
}
interface EncBlob {
  enc: true;
  salt: string;
  iv: string;
  ct: string;
  iter: number;
}
type Blob = PlainBlob | EncBlob;

const b64 = (buf: ArrayBuffer | Uint8Array) => btoa(String.fromCharCode(...new Uint8Array(buf)));
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

function safeGet(k: string): string | null {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
}
function safeSet(k: string, v: string) {
  try {
    localStorage.setItem(k, v);
  } catch {
    /* storage full or blocked */
  }
}
function safeRemove(k: string) {
  try {
    localStorage.removeItem(k);
  } catch {
    /* ignore */
  }
}

function readBlob(): Blob | null {
  const raw = safeGet(KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Blob;
  } catch {
    return null;
  }
}

function normalise(v: Partial<Vault>): Vault {
  return {
    ...emptyVault(),
    ...v,
    settings: { ...DEFAULT_SETTINGS, ...(v.settings ?? {}) },
    updates: v.updates ?? [],
    weightOverrides: v.weightOverrides ?? {},
    neededPlans: v.neededPlans ?? {},
  };
}

async function deriveKey(pin: string, salt: Uint8Array, iter: number): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: iter },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

export function isLocked(): boolean {
  return readBlob()?.enc === true;
}

export function hasVault(): boolean {
  return readBlob() !== null;
}

export function loadPlain(): Vault {
  const b = readBlob();
  if (b && b.enc === false) return normalise(b.data);
  return emptyVault();
}

/** A session holds the derived key so saves stay encrypted without asking again. */
export interface Session {
  key: CryptoKey | null;
  salt: Uint8Array | null;
}

export function pinFailures(): number {
  return Number(safeGet(FAILS) ?? 0) || 0;
}

export async function unlock(pin: string): Promise<{ vault: Vault; session: Session } | { error: string; wiped?: boolean }> {
  const b = readBlob();
  if (!b || b.enc !== true) return { vault: loadPlain(), session: { key: null, salt: null } };
  const salt = unb64(b.salt);
  try {
    const key = await deriveKey(pin, salt, b.iter);
    const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(b.iv) }, key, unb64(b.ct));
    safeRemove(FAILS);
    return { vault: normalise(JSON.parse(new TextDecoder().decode(pt))), session: { key, salt } };
  } catch {
    const fails = pinFailures() + 1;
    if (fails >= MAX_FAILS) {
      wipeAll();
      return { error: 'Too many wrong PINs. All data on this device was erased.', wiped: true };
    }
    safeSet(FAILS, String(fails));
    return { error: `Wrong PIN. ${MAX_FAILS - fails} attempt${MAX_FAILS - fails === 1 ? '' : 's'} left before data is erased.` };
  }
}

export async function save(vault: Vault, session: Session): Promise<void> {
  if (!session.key || !session.salt) {
    safeSet(KEY, JSON.stringify({ enc: false, data: vault } satisfies PlainBlob));
    return;
  }
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, session.key, new TextEncoder().encode(JSON.stringify(vault)));
  const blob: EncBlob = { enc: true, salt: b64(session.salt), iv: b64(iv), ct: b64(ct), iter: ITERATIONS };
  safeSet(KEY, JSON.stringify(blob));
}

export async function sessionForPin(pin: string): Promise<Session> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return { key: await deriveKey(pin, salt, ITERATIONS), salt };
}

export function wipeAll() {
  safeRemove(KEY);
  safeRemove(FAILS);
  try {
    sessionStorage.clear();
  } catch {
    /* ignore */
  }
}
