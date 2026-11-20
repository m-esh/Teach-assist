import { useState } from 'react';
import { useStore } from '../store';
import { Icon, IconTile, NavBar, Section, Segmented, Sheet, Toggle, timeAgo } from '../components/ui';
import { PinPad } from './Lock';
import { THEMES, loadLook, saveLook, type Appearance, type Look, type ThemeName } from '../lib/theme';

export function SettingsScreen() {
  const s = useStore();
  const { settings, creds, snapshot } = s.vault;
  const [look, setLook] = useState<Look>(loadLook);
  const [pinFlow, setPinFlow] = useState<null | 'set' | 'confirm'>(null);
  const [firstPin, setFirstPin] = useState('');
  const [pinError, setPinError] = useState('');
  const [confirmErase, setConfirmErase] = useState(false);
  const [relayKey, setRelayKey] = useState(settings.relayKey);

  const updateLook = (patch: Partial<Look>) => {
    const next = { ...look, ...patch };
    setLook(next);
    saveLook(next);
  };
  const masked = creds ? creds.username.replace(/.(?=.{3})/g, '•') : '';

  return (
    <div className="screen">
      <NavBar title="Settings" />

      <Section header="Theme">
        <div className="cell swatch-cell">
          <div className="swatches" role="radiogroup" aria-label="Theme colour">
            {(Object.keys(THEMES) as ThemeName[]).map((t) => (
              <button
                key={t}
                role="radio"
                aria-checked={look.theme === t}
                aria-label={THEMES[t].name}
                className={`swatch ${look.theme === t ? 'on' : ''}`}
                data-swatch={t}
                onClick={() => updateLook({ theme: t })}
              >
                <span>{look.theme === t && <Icon name="check" size={16} />}</span>
                <em>{THEMES[t].name}</em>
              </button>
            ))}
          </div>
        </div>
        <div className="cell">
          <Segmented<Appearance>
            label="Appearance"
            value={look.appearance}
            onChange={(appearance) => updateLook({ appearance })}
            options={[
              ['system', 'Automatic'],
              ['light', 'Light'],
              ['dark', 'Dark'],
            ]}
          />
        </div>
      </Section>

      <Section header="Account">
        <div className="cell">
          <IconTile name="person" color="var(--c-blue)" />
          <span className="cell-main">
            <span className="cell-title">Student Number</span>
          </span>
          <span className="cell-value">{masked}</span>
        </div>
        <button className="cell" onClick={() => void s.sync()} disabled={s.syncing}>
          <IconTile name="refresh" color="var(--c-green)" />
          <span className="cell-main">
            <span className="cell-title">{s.syncing ? 'Syncing…' : 'Sync Now'}</span>
          </span>
          <span className="cell-value">{timeAgo(snapshot?.fetchedAt)}</span>
        </button>
      </Section>

      <Section header="Privacy & Security" footer="A PIN encrypts everything this app stores on your phone. Ten wrong attempts erase it.">
        <div className="cell">
          <IconTile name="lock" color="var(--c-gray)" />
          <span className="cell-main">
            <span className="cell-title">Require PIN</span>
          </span>
          <Toggle
            label="Require PIN"
            checked={s.hasPin}
            onChange={(on) => {
              setPinError('');
              if (on) setPinFlow('set');
              else void s.setPin(null);
            }}
          />
        </div>
        {s.hasPin && (
          <button className="cell" onClick={() => setPinFlow('set')}>
            <IconTile name="key" color="var(--c-gray)" />
            <span className="cell-main">
              <span className="cell-title">Change PIN</span>
            </span>
            <span className="chev">
              <Icon name="chevron" size={16} />
            </span>
          </button>
        )}
      </Section>

      <Section header="General">
        <div className="cell">
          <IconTile name="clock" color="var(--c-orange)" />
          <span className="cell-main">
            <span className="cell-title">Refresh on Open</span>
          </span>
          <Toggle label="Refresh on open" checked={settings.autoRefresh} onChange={(v) => s.updateSettings({ autoRefresh: v })} />
        </div>
        <div className="cell">
          <IconTile name="eye" color="var(--c-teal)" />
          <span className="cell-main">
            <span className="cell-title">Hide Courses Without Marks</span>
          </span>
          <Toggle label="Hide courses without marks" checked={settings.hideEmptyCourses} onChange={(v) => s.updateSettings({ hideEmptyCourses: v })} />
        </div>
      </Section>

      <Section header="Advanced" footer="Only needed if an access key was set for your relay. Leave blank otherwise.">
        <label className="cell field-cell">
          <span className="cell-title">Relay Key</span>
          <input
            type="password"
            autoComplete="off"
            value={relayKey}
            placeholder="None"
            onChange={(e) => setRelayKey(e.target.value)}
            onBlur={() => relayKey !== settings.relayKey && s.updateSettings({ relayKey })}
            aria-label="Relay access key"
            className="right-input"
          />
        </label>
      </Section>

      <Section>
        <button className="cell" onClick={() => setConfirmErase(true)}>
          <span className="cell-title danger center-text">Sign Out</span>
        </button>
      </Section>

      <p className="about">
        Your password and marks are stored only on this device. Each sync goes through your own private relay straight to ta.yrdsb.ca; the relay keeps nothing.
        <br />
        Not affiliated with YRDSB or the teachassist foundation.
      </p>

      <Sheet open={pinFlow !== null} title={pinFlow === 'confirm' ? 'Confirm PIN' : 'New PIN'} onClose={() => setPinFlow(null)}>
        <div className="pin-sheet">
          <p className="pin-prompt">{pinFlow === 'confirm' ? 'Enter it again to confirm' : 'Choose a 6-digit PIN'}</p>
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
        </div>
      </Sheet>

      {confirmErase && (
        <div className="alert-backdrop" onClick={() => setConfirmErase(false)}>
          <div className="alert" role="alertdialog" aria-label="Sign out" onClick={(e) => e.stopPropagation()}>
            <div className="alert-body">
              <div className="alert-title">Sign Out?</div>
              <div className="alert-text">Your login, saved marks and update history will be erased from this device.</div>
            </div>
            <div className="alert-actions">
              <button onClick={() => setConfirmErase(false)}>Cancel</button>
              <button className="danger bold" onClick={s.signOut}>
                Sign Out
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
