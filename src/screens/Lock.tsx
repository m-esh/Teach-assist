import { useState } from 'react';
import { useStore } from '../store';
import { Icon } from '../components/ui';

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
  return (
    <div className="pinpad">
      <div className={`pin-dots ${error ? 'shake' : ''}`} aria-live="polite">
        {Array.from({ length: LEN }, (_, i) => (
          <span key={i} className={i < pin.length ? 'on' : ''} />
        ))}
      </div>
      <div className="pin-error">{busy ? 'Checking…' : error}</div>
      <div className="pin-keys">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
          <button key={d} onClick={() => void press(d)} aria-label={d}>
            {d}
          </button>
        ))}
        <span />
        <button onClick={() => void press('0')} aria-label="0">
          0
        </button>
        <button onClick={() => setPin(pin.slice(0, -1))} aria-label="Delete" className="pin-del">
          ⌫
        </button>
      </div>
    </div>
  );
}

export function LockScreen() {
  const { unlock } = useStore();
  const [error, setError] = useState('');
  return (
    <div className="screen center-screen">
      <div className="lock-icon">
        <Icon name="lock" size={34} />
      </div>
      <h1>Enter PIN</h1>
      <PinPad
        error={error}
        onComplete={async (pin) => {
          const e = await unlock(pin);
          setError(e ?? '');
        }}
      />
    </div>
  );
}
