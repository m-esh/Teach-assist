import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { fetchSnapshot, SyncError } from './lib/api';
import { diffSnapshots, mergeUpdates } from './lib/updates';
import * as storage from './lib/storage';
import type { Assessment, Course } from './lib/types';
import type { NeededPlan, Settings, Vault } from './lib/storage';

/** What-if edits for one course. Kept in memory only, so they reset each session. */
export interface WhatIf {
  removed: string[];
  edited: Record<string, Assessment>;
  added: Assessment[];
}
export const emptyWhatIf = (): WhatIf => ({ removed: [], edited: {}, added: [] });

type Phase = 'loading' | 'locked' | 'login' | 'ready';

interface Store {
  phase: Phase;
  vault: Vault;
  syncing: boolean;
  syncError: string | null;
  hasPin: boolean;
  hasBio: boolean;
  enableBio(): Promise<string | null>;
  disableBio(): Promise<void>;
  unlockWithBio(): Promise<string | null>;
  signIn(username: string, password: string, relayKey: string): Promise<string | null>;
  sync(): Promise<void>;
  unlock(pin: string): Promise<string | null>;
  setPin(pin: string | null): Promise<void>;
  updateSettings(s: Partial<Settings>): void;
  setWeights(courseCode: string, weights: Record<string, number> | null): void;
  setNeededPlan(courseCode: string, plan: NeededPlan): void;
  markUpdatesSeen(): void;
  clearUpdates(): void;
  signOut(): void;
  whatIf(courseId: string): WhatIf;
  setWhatIf(courseId: string, w: WhatIf): void;
  courseById(id: string): Course | undefined;
}

const Ctx = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [phase, setPhase] = useState<Phase>('loading');
  const [vault, setVault] = useState<Vault>(storage.emptyVault());
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [whatIfs, setWhatIfs] = useState<Record<string, WhatIf>>({});
  const session = useRef<storage.Session>(storage.noSession());
  const vaultRef = useRef(vault);
  vaultRef.current = vault;
  const syncingRef = useRef(false);

  const persist = useCallback((next: Vault) => {
    setVault(next);
    vaultRef.current = next;
    void storage.save(next, session.current);
  }, []);

  const doSync = useCallback(
    async (v: Vault): Promise<string | null> => {
      if (!v.creds || syncingRef.current) return null;
      syncingRef.current = true;
      setSyncing(true);
      try {
        const snap = await fetchSnapshot(v.creds.username, v.creds.password, v.settings.relayKey);
        const latest = vaultRef.current;
        const fresh = diffSnapshots(latest.snapshot, snap);
        persist({ ...latest, snapshot: snap, updates: mergeUpdates(latest.updates, fresh) });
        setSyncError(null);
        return null;
      } catch (e) {
        const msg = e instanceof SyncError ? e.message : 'Sync failed. Try again.';
        setSyncError(msg);
        return msg;
      } finally {
        syncingRef.current = false;
        setSyncing(false);
      }
    },
    [persist],
  );

  const enter = useCallback(
    (v: Vault) => {
      setVault(v);
      vaultRef.current = v;
      if (v.creds) {
        setPhase('ready');
        if (v.settings.autoRefresh || !v.snapshot) void doSync(v);
      } else setPhase('login');
    },
    [doSync],
  );

  useEffect(() => {
    if (storage.isLocked()) setPhase('locked');
    else enter(storage.loadPlain());
  }, [enter]);

  // Refresh when the app comes back to the foreground (at most every 2 minutes).
  useEffect(() => {
    let last = Date.now();
    const onVis = () => {
      const v = vaultRef.current;
      if (document.visibilityState === 'visible' && phase === 'ready' && v.settings.autoRefresh && Date.now() - last > 120_000) {
        last = Date.now();
        void doSync(v);
      }
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [phase, doSync]);

  const value = useMemo<Store>(
    () => ({
      phase,
      vault,
      syncing,
      syncError,
      hasPin: !!session.current.dek,
      hasBio: !!session.current.bio,
      async signIn(username, password, relayKey) {
        const v: Vault = { ...vaultRef.current, creds: { username, password }, settings: { ...vaultRef.current.settings, relayKey } };
        try {
          const snap = await fetchSnapshot(username, password, relayKey);
          persist({ ...v, snapshot: snap, updates: [] });
          setSyncError(null);
          setPhase('ready');
          return null;
        } catch (e) {
          return e instanceof SyncError ? e.message : 'Could not sign in. Try again.';
        }
      },
      sync: async () => {
        await doSync(vaultRef.current);
      },
      async unlock(pin) {
        const r = await storage.unlock(pin);
        if ('error' in r) {
          if (r.wiped) {
            session.current = storage.noSession();
            enter(storage.emptyVault());
          }
          return r.error;
        }
        session.current = r.session;
        enter(r.vault);
        return null;
      },
      async enableBio() {
        try {
          session.current = await storage.enableBio(session.current);
          await storage.save(vaultRef.current, session.current);
          setVault({ ...vaultRef.current });
          return null;
        } catch (e) {
          return e instanceof storage.BioError ? e.message : "Face ID couldn't be set up.";
        }
      },
      async disableBio() {
        session.current = { ...session.current, bio: null };
        await storage.save(vaultRef.current, session.current);
        setVault({ ...vaultRef.current });
      },
      async unlockWithBio() {
        try {
          const r = await storage.unlockWithBio();
          session.current = r.session;
          enter(r.vault);
          return null;
        } catch (e) {
          return e instanceof storage.BioError ? (e.code === 'cancelled' ? '' : e.message) : "Face ID didn't work. Use your PIN.";
        }
      },
      async setPin(pin) {
        session.current = pin ? await storage.sessionForPin(pin, session.current) : storage.noSession();
        await storage.save(vaultRef.current, session.current);
        setVault({ ...vaultRef.current });
      },
      updateSettings(s) {
        persist({ ...vaultRef.current, settings: { ...vaultRef.current.settings, ...s } });
      },
      setWeights(code, weights) {
        const o = { ...vaultRef.current.weightOverrides };
        if (weights) o[code] = weights;
        else delete o[code];
        persist({ ...vaultRef.current, weightOverrides: o });
      },
      setNeededPlan(code, plan) {
        const v = vaultRef.current;
        persist({ ...v, neededPlans: { ...v.neededPlans, [code]: plan } });
      },
      markUpdatesSeen() {
        const v = vaultRef.current;
        if (v.updates.some((u) => !u.seen)) persist({ ...v, updates: v.updates.map((u) => ({ ...u, seen: true })) });
      },
      clearUpdates() {
        persist({ ...vaultRef.current, updates: [] });
      },
      signOut() {
        storage.wipeAll();
        session.current = storage.noSession();
        setWhatIfs({});
        setSyncError(null);
        setVault(storage.emptyVault());
        vaultRef.current = storage.emptyVault();
        setPhase('login');
      },
      whatIf: (id) => whatIfs[id] ?? emptyWhatIf(),
      setWhatIf: (id, w) => setWhatIfs((all) => ({ ...all, [id]: w })),
      courseById: (id) => vault.snapshot?.courses.find((c) => c.id === id),
    }),
    [phase, vault, syncing, syncError, whatIfs, persist, doSync, enter],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error('StoreProvider missing');
  return s;
}
