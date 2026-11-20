import { useState } from 'react';
import { useStore } from '../store';
import { Icon } from '../components/ui';

export function LoginScreen() {
  const { signIn } = useStore();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [relayKey, setRelayKey] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password || busy) return;
    setBusy(true);
    setError('');
    const err = await signIn(username.trim(), password, relayKey.trim());
    setBusy(false);
    if (err) setError(err);
  };

  return (
    <div className="login">
      <div className="login-head">
        <img src="/icon.svg" alt="" className="login-logo" width={76} height={76} />
        <h1>TeachAssist</h1>
        <p>Sign in with your YRDSB student number.</p>
      </div>
      <form onSubmit={submit} className="login-form">
        <div className="group">
          <label className="cell field-cell">
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Student number"
              inputMode="numeric"
              autoComplete="username"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              aria-label="Student number"
            />
          </label>
          <label className="cell field-cell">
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" autoComplete="current-password" aria-label="Password" />
          </label>
          {showAdvanced && (
            <label className="cell field-cell">
              <input type="password" value={relayKey} onChange={(e) => setRelayKey(e.target.value)} placeholder="Relay key (optional)" autoComplete="off" aria-label="Relay access key" />
            </label>
          )}
        </div>
        {error && <div className="form-error">{error}</div>}
        <button className="btn-primary" disabled={busy || !username.trim() || !password}>
          {busy ? <span className="spinner" aria-label="Signing in" /> : 'Sign In'}
        </button>
        {!showAdvanced && (
          <button type="button" className="text-btn" onClick={() => setShowAdvanced(true)}>
            Advanced
          </button>
        )}
      </form>
      <div className="login-privacy">
        <Icon name="shield" size={18} />
        <span>Your login stays on this phone and is only ever sent to TeachAssist, through your own private relay that stores nothing.</span>
      </div>
    </div>
  );
}
