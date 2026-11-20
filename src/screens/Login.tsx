import { useState } from 'react';
import { useStore } from '../store';

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
    <div className="screen center-screen login">
      <img src="/icon.svg" alt="" className="login-logo" width={84} height={84} />
      <h1>TeachAssist</h1>
      <p className="muted center">Your marks, without the ads.</p>
      <form className="card login-card" onSubmit={submit}>
        <label className="field">
          <span>Student number</span>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            inputMode="numeric"
            autoComplete="username"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            aria-label="Student number"
          />
        </label>
        <label className="field">
          <span>Password</span>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" aria-label="Password" />
        </label>
        {showAdvanced ? (
          <label className="field">
            <span>Relay access key (optional)</span>
            <input type="password" value={relayKey} onChange={(e) => setRelayKey(e.target.value)} autoComplete="off" aria-label="Relay access key" />
          </label>
        ) : (
          <button type="button" className="link small" onClick={() => setShowAdvanced(true)}>
            Advanced
          </button>
        )}
        {error && <div className="banner warn">{error}</div>}
        <button className="btn primary block" disabled={busy || !username.trim() || !password}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
      <p className="faint small center privacy">
        Your login is saved only on this phone and is sent only to TeachAssist (through this app's private relay, which stores nothing). You can add a PIN in
        Settings.
      </p>
    </div>
  );
}
