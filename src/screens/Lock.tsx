import { useEffect, useState } from 'react';
import { useStore } from '../store';
import { Icon } from '../components/ui';
import { bioEnabled } from '../lib/storage';

const LEN = 6;

export function PinPad({ onComplete, error }: { onComplete(pin: string): void | Promise<void>; error?: string }) {
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const press = async (d: string) => {
    if (busy) return;
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
          </button>
        ))}
        <span />
        <button onClick={() => void press('0')} aria-label="0">
          <span className="digit">0</span>
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
  const [busy, setBusy] = useState(false);
  const bio = bioEnabled();

  const tryBio = async () => {
    if (busy) return;
    setBusy(true);
    setBioMsg('');
    const e = await unlockWithBio();
    setBusy(false);
    if (e) setBioMsg(e);
  };

  // Ask for Face ID as soon as the app opens (iOS may want a tap first; the button covers that).
  useEffect(() => {
    if (bio) void tryBio();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="lock-screen">
      <span className="lock-icon">
        <Icon name={bio ? 'faceid' : 'lock'} size={28} />
      </span>
      <div className="lock-title">{bio ? 'Unlock TeachAssist' : 'Enter PIN'}</div>
      <PinPad
        error={error || bioMsg}
        onComplete={async (pin) => {
          const e = await unlock(pin);
          setError(e ?? '');
        }}
      />
      {bio && (
        <button className="text-btn face-btn" onClick={() => void tryBio()} disabled={busy}>
          <Icon name="faceid" size={20} /> Use Face ID
        </button>
      )}
    </div>
  );
}
