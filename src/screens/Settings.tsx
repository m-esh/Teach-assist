import { useState } from 'react';
import { useStore } from '../store';
import { Icon, Sheet, Toggle, timeAgo } from '../components/ui';
import { PinPad } from './Lock';

export function SettingsScreen() {
  const s = useStore();
  const { settings, creds, snapshot } = s.vault;
  const [pinFlow, setPinFlow] = useState<null | 'set' | 'confirm'>(null);
  const [firstPin, setFirstPin] = useState('');
  const [pinError, setPinError] = useState('');
  const [confirmErase, setConfirmErase] = useState(false);
  const [relayKey, setRelayKey] = useState(settings.relayKey);

  const masked = creds ? creds.username.replace(/.(?=.{3})/g, '•') : '';

  return (
    <div className="screen">
      <header className="top">
        <div>
          <h1>Settings</h1>
        </div>
      </header>

      <h3 className="group-label">Account</h3>
      <div className="card settings">
        <div className="setting">
          <span>Student number</span>
          <span className="muted">{masked}</span>
        </div>
        <div className="setting">
          <span>Last synced</span>
          <span className="muted">{timeAgo(snapshot?.fetchedAt)}</span>
        </div>
        <button className="setting action" onClick={() => void s.sync()} disabled={s.syncing}>
          <span>{s.syncing ? 'Syncing…' : 'Sync now'}</span>
          <Icon name="refresh" size={18} />
        </button>
      </div>

      <h3 className="group-label">Security</h3>
      <div className="card settings">
        <div className="setting">
          <span>
            App PIN
            <div className="faint small">Encrypts everything stored on this device</div>
          </span>
          <Toggle
            label="App PIN"
            checked={s.hasPin}
            onChange={(on) => {
              setPinError('');
              if (on) setPinFlow('set');
              else void s.setPin(null);
            }}
          />
        </div>
        {s.hasPin && (
          <button className="setting action" onClick={() => setPinFlow('set')}>
            <span>Change PIN</span>
            <Icon name="lock" size={18} />
          </button>
        )}
      </div>

      <h3 className="group-label">App</h3>
      <div className="card settings">
        <div className="setting">
          <span>
            Refresh when opened
            <div className="faint small">Checks TeachAssist each time you open the app</div>
          </span>
          <Toggle label="Refresh when opened" checked={settings.autoRefresh} onChange={(v) => s.updateSettings({ autoRefresh: v })} />
        </div>
        <div className="setting">
          <span>Hide courses without marks</span>
          <Toggle label="Hide courses without marks" checked={settings.hideEmptyCourses} onChange={(v) => s.updateSettings({ hideEmptyCourses: v })} />
        </div>
        <button className="setting action" onClick={s.clearUpdates}>
          <span>Clear update history</span>
          <Icon name="trash" size={18} />
        </button>
      </div>

      <h3 className="group-label">Advanced</h3>
      <div className="card settings">
        <label className="setting col">
          <span>
            Relay access key
            <div className="faint small">Only needed if one was set up for the server. Leave blank otherwise.</div>
          </span>
          <input
            type="password"
            autoComplete="off"
            value={relayKey}
            onChange={(e) => setRelayKey(e.target.value)}
            onBlur={() => relayKey !== settings.relayKey && s.updateSettings({ relayKey })}
            aria-label="Relay access key"
          />
        </label>
      </div>

      <div className="card settings">
        <button className="setting action danger" onClick={() => setConfirmErase(true)}>
          <span>Sign out and erase this device</span>
          <Icon name="trash" size={18} />
        </button>
      </div>

      <div className="about faint small">
        <p>
          Private TeachAssist. Your password and marks are stored only on this device. Each sync sends your login through this app's own relay
          straight to ta.yrdsb.ca; the relay keeps nothing and logs nothing.
        </p>
        <p>Not affiliated with YRDSB or the teachassist foundation.</p>
      </div>

      <Sheet open={pinFlow !== null} title={pinFlow === 'confirm' ? 'Confirm PIN' : 'Choose a 6-digit PIN'} onClose={() => setPinFlow(null)}>
        <PinPad
          key={pinFlow ?? 'x'}
          error={pinError}
          onComplete={async (pin) => {
            if (pinFlow === 'set') {
              setFirstPin(pin);
              setPinError('');
              setPinFlow('confirm');
            } else if (pin !== firstPin) {
              setPinError("PINs didn't match. Try again.");
              setPinFlow('set');
            } else {
              await s.setPin(pin);
              setPinFlow(null);
            }
          }}
        />
        <p className="faint small center">If you forget it, you'll need to sign in again. Ten wrong tries erase the app's data.</p>
      </Sheet>

      <Sheet open={confirmErase} title="Sign out?" onClose={() => setConfirmErase(false)}>
        <p className="muted">This removes your login, saved marks and update history from this device.</p>
        <button className="btn danger block" onClick={s.signOut}>
          Sign out and erase
        </button>
        <button className="btn ghost block" onClick={() => setConfirmErase(false)}>
          Cancel
        </button>
      </Sheet>
    </div>
  );
}
