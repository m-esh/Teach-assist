// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { emptyVault, isLocked, save, sessionForPin, unlock } from '../src/lib/storage';

const b64 = (buf: ArrayBuffer | Uint8Array) => btoa(String.fromCharCode(...new Uint8Array(buf)));

async function writeV1(pin: string, data: object) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveKey']);
  const key = await crypto.subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: 1000 }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt']);
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(JSON.stringify(data)));
  localStorage.setItem('ta.vault.v1', JSON.stringify({ enc: true, salt: b64(salt), iv: b64(iv), ct: b64(ct), iter: 1000 }));
}

describe('encrypted vault', () => {
  it('upgrades a PIN vault from the old format and keeps the data', async () => {
    localStorage.clear();
    await writeV1('111111', { ...emptyVault(), creds: { username: 'u', password: 'secret' } });
    const r = await unlock('111111');
    expect('vault' in r && r.vault.creds?.password).toBe('secret');
    const blob = JSON.parse(localStorage.getItem('ta.vault.v1')!);
    expect(blob.v).toBe(2);
    expect(JSON.stringify(blob)).not.toContain('secret');
    const again = await unlock('111111');
    expect('vault' in again && again.vault.creds?.username).toBe('u');
  }, 20000);

  it('changing the PIN keeps the data and rejects the old PIN', async () => {
    localStorage.clear();
    const s1 = await sessionForPin('123456');
    await save({ ...emptyVault(), creds: { username: 'a', password: 'b' } }, s1);
    expect(isLocked()).toBe(true);
    const s2 = await sessionForPin('654321', s1);
    expect(s2.dek).toEqual(s1.dek);
    await save({ ...emptyVault(), creds: { username: 'a', password: 'b' } }, s2);
    expect('error' in (await unlock('123456'))).toBe(true);
    const ok = await unlock('654321');
    expect('vault' in ok && ok.vault.creds?.username).toBe('a');
  }, 20000);
});
