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

export interface PlanItem {
  /** How many marks are still to come in this category. */
  count: number;
  /** A score you already expect on each of them (%); null = solve for it. */
  expected?: number | null;
  /** Weight of each inside the category; null = like your other marks there. */
  weight?: number | null;
}

export interface NeededPlan {
  target: number;
  /** category key -> what's still to come there */
  items?: Record<string, PlanItem>;
  /** Older saved format (one shared count + final switch). Read once, then replaced. */
  left?: number;
  weights?: Record<string, number>;
  final?: boolean;
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
/** v1: data encrypted directly with a PIN-derived key (read for upgrade only). */
interface EncBlobV1 {
  enc: true;
  v?: undefined;
  salt: string;
  iv: string;
  ct: string;
  iter: number;
}
/** A copy of the data key, locked with one unlock method. */
interface Wrap {
  iv: string;
  wk: string;
}
interface PinWrap extends Wrap {
  salt: string;
  iter: number;
}
interface BioWrap extends Wrap {
  /** WebAuthn credential id (Face ID passkey for this app). */
  cred: string;
  /** Input to the passkey's PRF that produces the unlocking secret. */
  prf: string;
}
/** v2: data encrypted with a random data key; the key is stored locked by PIN and, optionally, Face ID. */
interface EncBlobV2 {
  enc: true;
  v: 2;
  iv: string;
  ct: string;
  pin: PinWrap;
  bio?: BioWrap;
}
type Blob = PlainBlob | EncBlobV1 | EncBlobV2;

const b64 = (buf: ArrayBuffer | Uint8Array) => btoa(String.fromCharCode(...new Uint8Array(buf)));
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const rand = (n: number) => crypto.getRandomValues(new Uint8Array(n));

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

async function pinKey(pin: string, salt: Uint8Array, iter: number): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: iter },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}
const aesKey = (raw: Uint8Array) => crypto.subtle.importKey('raw', raw, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);

async function wrap(dek: Uint8Array, key: CryptoKey): Promise<Wrap> {
  const iv = rand(12);
  return { iv: b64(iv), wk: b64(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, dek)) };
}
async function unwrap(w: Wrap, key: CryptoKey): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(w.iv) }, key, unb64(w.wk)));
}
async function decryptVault(b: EncBlobV2, dek: Uint8Array): Promise<Vault> {
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(b.iv) }, await aesKey(dek), unb64(b.ct));
  return normalise(JSON.parse(new TextDecoder().decode(pt)));
}

export function isLocked(): boolean {
  return readBlob()?.enc === true;
}

export function hasVault(): boolean {
  return readBlob() !== null;
}

/** Whether Face ID unlock is set up on this device. */
export function bioEnabled(): boolean {
  const b = readBlob();
  return !!b && b.enc === true && b.v === 2 && !!b.bio;
}

export function loadPlain(): Vault {
  const b = readBlob();
  if (b && b.enc === false) return normalise(b.data);
  return emptyVault();
}

/** Held in memory while unlocked so saves stay encrypted without asking again. */
export interface Session {
  dek: Uint8Array | null;
  pin: PinWrap | null;
  bio: BioWrap | null;
}
export const noSession = (): Session => ({ dek: null, pin: null, bio: null });

export function pinFailures(): number {
  return Number(safeGet(FAILS) ?? 0) || 0;
}

type UnlockResult = { vault: Vault; session: Session } | { error: string; wiped?: boolean };

export async function unlock(pin: string): Promise<UnlockResult> {
  const b = readBlob();
  if (!b || b.enc !== true) return { vault: loadPlain(), session: noSession() };
  try {
    let vault: Vault;
    let session: Session;
    if (b.v === 2) {
      const dek = await unwrap(b.pin, await pinKey(pin, unb64(b.pin.salt), b.pin.iter));
      vault = await decryptVault(b, dek);
      session = { dek, pin: b.pin, bio: b.bio ?? null };
    } else {
      // Upgrade the older format to a data key locked by the PIN.
      const key = await pinKey(pin, unb64(b.salt), b.iter);
      const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(b.iv) }, key, unb64(b.ct));
      vault = normalise(JSON.parse(new TextDecoder().decode(pt)));
      session = await sessionForPin(pin);
      await save(vault, session);
    }
    safeRemove(FAILS);
    return { vault, session };
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
  if (!session.dek || !session.pin) {
    safeSet(KEY, JSON.stringify({ enc: false, data: vault } satisfies PlainBlob));
    return;
  }
  const iv = rand(12);
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await aesKey(session.dek), new TextEncoder().encode(JSON.stringify(vault)));
  const blob: EncBlobV2 = { enc: true, v: 2, iv: b64(iv), ct: b64(ct), pin: session.pin, ...(session.bio ? { bio: session.bio } : {}) };
  safeSet(KEY, JSON.stringify(blob));
}

/** Sets or changes the PIN. Keeps the data key (and Face ID) when one already exists. */
export async function sessionForPin(pin: string, current?: Session): Promise<Session> {
  const dek = current?.dek ?? rand(32);
  const salt = rand(16);
  const pinWrap: PinWrap = { ...(await wrap(dek, await pinKey(pin, salt, ITERATIONS))), salt: b64(salt), iter: ITERATIONS };
  return { dek, pin: pinWrap, bio: current?.dek ? current.bio : null };
}

/* ------------------------------------------------------------------ */
/* Face ID (WebAuthn passkey + PRF extension)                          */
/* ------------------------------------------------------------------ */

export class BioError extends Error {
  constructor(
    message: string,
    public code: 'unsupported' | 'cancelled' | 'failed',
  ) {
    super(message);
  }
}

type PrfResults = { prf?: { enabled?: boolean; results?: { first?: ArrayBuffer } } };
const prfInput = (salt: Uint8Array) => ({ prf: { eval: { first: salt } } }) as unknown as AuthenticationExtensionsClientInputs;

export async function bioAvailable(): Promise<boolean> {
  try {
    return !!window.PublicKeyCredential && (await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable());
  } catch {
    return false;
  }
}

function asBioError(e: unknown): BioError {
  if (e instanceof BioError) return e;
  const name = (e as { name?: string })?.name;
  if (name === 'NotAllowedError' || name === 'AbortError') return new BioError('Face ID was cancelled.', 'cancelled');
  return new BioError("Face ID couldn't be used here.", 'failed');
}

async function bioSecret(credId: Uint8Array, salt: Uint8Array): Promise<Uint8Array> {
  const cred = (await navigator.credentials.get({
    publicKey: {
      challenge: rand(32),
      rpId: location.hostname,
      allowCredentials: [{ type: 'public-key', id: credId }],
      userVerification: 'required',
      timeout: 60_000,
      extensions: prfInput(salt),
    },
  })) as PublicKeyCredential | null;
  const out = (cred?.getClientExtensionResults() as PrfResults | undefined)?.prf?.results?.first;
  if (!out) throw new BioError('This iPhone or browser version doesn\'t support unlocking with Face ID. Update iOS, or keep using your PIN.', 'unsupported');
  return new Uint8Array(out);
}

/** Creates the Face ID passkey and adds a Face ID–locked copy of the data key. */
export async function enableBio(session: Session): Promise<Session> {
  if (!session.dek) throw new BioError('Set a PIN first.', 'failed');
  if (!(await bioAvailable())) throw new BioError('Face ID isn\'t available for this app on this device.', 'unsupported');
  try {
    const salt = rand(32);
    const cred = (await navigator.credentials.create({
      publicKey: {
        challenge: rand(32),
        rp: { name: 'TeachAssist', id: location.hostname },
        user: { id: rand(16), name: 'TeachAssist', displayName: 'TeachAssist' },
        pubKeyCredParams: [
          { type: 'public-key', alg: -7 },
          { type: 'public-key', alg: -257 },
        ],
        authenticatorSelection: { authenticatorAttachment: 'platform', residentKey: 'preferred', userVerification: 'required' },
        attestation: 'none',
        timeout: 60_000,
        extensions: prfInput(salt),
      },
    })) as PublicKeyCredential | null;
    if (!cred) throw new BioError('Face ID was cancelled.', 'cancelled');
    const ext = cred.getClientExtensionResults() as PrfResults;
    if (ext.prf?.enabled === false) {
      throw new BioError('This iPhone or browser version doesn\'t support unlocking with Face ID. Update iOS, or keep using your PIN.', 'unsupported');
    }
    const credId = new Uint8Array(cred.rawId);
    const first = ext.prf?.results?.first;
    const secret = first ? new Uint8Array(first) : await bioSecret(credId, salt);
    const w = await wrap(session.dek, await aesKey(secret));
    return { ...session, bio: { ...w, cred: b64(credId), prf: b64(salt) } };
  } catch (e) {
    throw asBioError(e);
  }
}

export async function unlockWithBio(): Promise<{ vault: Vault; session: Session }> {
  const b = readBlob();
  if (!b || b.enc !== true || b.v !== 2 || !b.bio) throw new BioError('Face ID isn\'t set up.', 'failed');
  try {
    const secret = await bioSecret(unb64(b.bio.cred), unb64(b.bio.prf));
    const dek = await unwrap(b.bio, await aesKey(secret));
    const vault = await decryptVault(b, dek);
    safeRemove(FAILS);
    return { vault, session: { dek, pin: b.pin, bio: b.bio } };
  } catch (e) {
    throw asBioError(e);
  }
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
