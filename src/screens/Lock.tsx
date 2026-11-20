import { useEffect, useRef, useState } from 'react';
import { useStore } from '../store';
import { HapticTarget, Icon } from '../components/ui';
import { bioEnabled } from '../lib/storage';
import { haptic } from '../lib/haptics';

const LEN = 6;

export function PinPad({ onComplete, error }: { onComplete(pin: string): void | Promise<void>; error?: string }) {
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const press = async (d: string) => {
    if (busy) return;
    haptic('light');
    const next = (pin + d).slice(0, LEN);
    setPin(next);
    if (next.length === LEN) {
      setBusy(true);
      try {
        await onComplete(next);
      } finally {
        setBusy(false);
        setPin('');
      }
    }
  };
  const keys: Array<[string, string]> = [
    ['1', ''], ['2', 'ABC'], ['3', 'DEF'], ['4', 'GHI'], ['5', 'JKL'], ['6', 'MNO'], ['7', 'PQRS'], ['8', 'TUV'], ['9', 'WXYZ'],
  ];
  return (
    <div className="pinpad">
      <div className={`pin-dots ${error ? 'shake' : ''}`} key={error} aria-live="polite">
        {Array.from({ length: LEN }, (_, i) => (
          <span key={i} className={i < pin.length ? 'on' : ''} />
        ))}
      </div>
      <div className="pin-error">{busy ? '' : error}</div>
      <div className="pin-keys">
        {keys.map(([d, letters]) => (
          <button key={d} onClick={() => void press(d)} aria-label={d}>
            <span className="digit">{d}</span>
            <span className="letters">{letters}</span>
            <HapticTarget />
          </button>
        ))}
        <span />
        <button onClick={() => void press('0')} aria-label="0">
          <span className="digit">0</span>
          <HapticTarget />
        </button>
        <button onClick={() => setPin(pin.slice(0, -1))} aria-label="Delete" className="pin-del">
          {pin.length ? 'Delete' : ''}
        </button>
      </div>
    </div>
  );
}

export function LockScreen() {
  const { unlock, unlockWithBio } = useStore();
  const [error, setError] = useState('');
  const [bioMsg, setBioMsg] = useState('');
  const [armed, setArmed] = useState(false);
  const busy = useRef(false);
  const bio = bioEnabled();

  const tryBio = async () => {
    if (busy.current) return;
    busy.current = true;
    setBioMsg('');
    const started = performance.now();
    const e = await unlockWithBio();
    busy.current = false;
    if (e === null) return;
    // iOS refuses Face ID before the first touch, and says no instantly. In that
    // case wait for the first tap anywhere instead of showing an error.
    if (e === '' && performance.now() - started < 700) setArmed(true);
    else if (e) setBioMsg(e);
  };

  useEffect(() => {
    if (!bio) return;
    void tryBio();
    const onVisible = () => document.visibilityState === 'visible' && void tryBio();
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // First tap anywhere (except the number keys) starts Face ID.
  useEffect(() => {
    if (!armed) return;
    const onTap = (e: Event) => {
      if ((e.target as Element | null)?.closest('.pin-keys')) return;
      setArmed(false);
      void tryBio();
    };
    document.addEventListener('click', onTap, true);
    return () => document.removeEventListener('click', onTap, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [armed]);

  return (
    <div className="lock-screen">
      <span className="lock-icon">
        <Icon name={bio ? 'faceid' : 'lock'} size={28} />
      </span>
      <div className="lock-title">{bio ? 'Unlock TeachAssist' : 'Enter PIN'}</div>
      {bio && armed && <div className="lock-hint">Tap anywhere for Face ID</div>}
      <PinPad
        error={error || bioMsg}
        onComplete={async (pin) => {
          const e = await unlock(pin);
          if (e) haptic('error');
          setError(e ?? '');
        }}
      />
      {bio && (
        <button className="text-btn face-btn" onClick={() => void tryBio()}>
          <Icon name="faceid" size={20} /> Use Face ID
        </button>
      )}
    </div>
  );
}
