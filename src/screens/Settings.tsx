import { useState } from 'react';
import { useStore } from '../store';
import { HapticTarget, Icon, IconTile, NavBar, Section, Segmented, Sheet, Toggle, timeAgo } from '../components/ui';
import { PinPad } from './Lock';
import { THEMES, loadLook, saveLook, type Appearance, type Look, type ThemeName } from '../lib/theme';
import { applyHapticsSetting, haptic } from '../lib/haptics';

export function SettingsScreen() {
  const s = useStore();
  const { settings, creds, snapshot } = s.vault;
  const [look, setLook] = useState<Look>(loadLook);
  const [pinFlow, setPinFlow] = useState<null | 'set' | 'confirm'>(null);
  const [firstPin, setFirstPin] = useState('');
  const [pinError, setPinError] = useState('');
  const [bioError, setBioError] = useState('');
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

      <Section header="Appearance">
        <div className="row swatch-row">
          <div className="swatches" role="radiogroup" aria-label="Theme colour">
            {(Object.keys(THEMES) as ThemeName[]).map((t) => (
              <button
                key={t}
                role="radio"
                aria-checked={look.theme === t}
                aria-label={THEMES[t].name}
                className={`swatch ${look.theme === t ? 'on' : ''}`}
                data-swatch={t}
                onClick={() => {
                  if (t !== look.theme) haptic('light');
                  updateLook({ theme: t });
                }}
              >
                <span>{look.theme === t && <Icon name="check" size={16} />}</span>
                <em>{THEMES[t].name}</em>
                <HapticTarget />
              </button>
            ))}
          </div>
        </div>
        <div className="row">
          <Segmented<Appearance>
            label="Appearance"
            value={look.appearance}
            onChange={(appearance) => updateLook({ appearance })}
            options={[
              ['system', 'Auto', 'auto'],
              ['light', 'Light', 'sun'],
              ['dark', 'Dark', 'moon'],
            ]}
          />
        </div>
      </Section>

      <Section header="Feel">
        <div className="row">
          <IconTile name="wave" color="linear-gradient(150deg,#ff8ab5,#e8457f)" />
          <span className="row-main">
            <span className="row-title">Haptics</span>
            <span className="row-sub">Small taps when you use controls</span>
          </span>
          <Toggle
            label="Haptics"
            checked={look.haptics}
            onChange={(on) => {
              updateLook({ haptics: on });
              applyHapticsSetting(on);
              if (on) haptic('success');
            }}
          />
        </div>
      </Section>

      <Section header="Account">
        <div className="row">
          <IconTile name="person" color="linear-gradient(150deg,#5ac8fa,#007aff)" />
          <span className="row-main">
            <span className="row-title">Student Number</span>
          </span>
          <span className="row-value">{masked}</span>
        </div>
        <button className="row" onClick={() => void s.sync()} disabled={s.syncing}>
          <IconTile name="refresh" color="linear-gradient(150deg,#5be37d,#28b04b)" />
          <span className="row-main">
            <span className="row-title">{s.syncing ? 'Syncing…' : 'Sync Now'}</span>
          </span>
          <span className="row-value">{timeAgo(snapshot?.fetchedAt)}</span>
        </button>
      </Section>

      <Section
        header="Privacy & Security"
        footer={
          bioError ||
          (s.hasPin
            ? 'Your PIN and Face ID each unlock the encryption on this phone. Ten wrong PINs erase the data.'
            : 'A PIN encrypts everything this app stores on your phone. You can then turn on Face ID.')
        }
      >
        <div className="row">
          <IconTile name="lock" color="linear-gradient(150deg,#b4b4be,#7c7c86)" />
          <span className="row-main">
            <span className="row-title">Require PIN</span>
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
          <div className="row">
            <IconTile name="faceid" color="linear-gradient(150deg,#5be37d,#28b04b)" />
            <span className="row-main">
              <span className="row-title">Unlock with Face ID</span>
            </span>
            <Toggle
              label="Unlock with Face ID"
              checked={s.hasBio}
              onChange={async (on) => {
                setBioError('');
                if (on) {
                  const e = await s.enableBio();
                  if (e) setBioError(e);
                } else await s.disableBio();
              }}
            />
          </div>
        )}
        {s.hasPin && (
          <button className="row" onClick={() => setPinFlow('set')}>
            <IconTile name="key" color="linear-gradient(150deg,#b4b4be,#7c7c86)" />
            <span className="row-main">
              <span className="row-title">Change PIN</span>
            </span>
            <span className="chev">
              <Icon name="chevron" size={16} />
            </span>
          </button>
        )}
      </Section>

      <Section header="General">
        <div className="row">
          <IconTile name="clock" color="linear-gradient(150deg,#ffc04d,#ff8a00)" />
          <span className="row-main">
            <span className="row-title">Refresh on Open</span>
          </span>
          <Toggle label="Refresh on open" checked={settings.autoRefresh} onChange={(v) => s.updateSettings({ autoRefresh: v })} />
        </div>
        <div className="row">
          <IconTile name="eye" color="linear-gradient(150deg,#6ee0f0,#1fa9c6)" />
          <span className="row-main">
            <span className="row-title">Hide Courses Without Marks</span>
          </span>
          <Toggle label="Hide courses without marks" checked={settings.hideEmptyCourses} onChange={(v) => s.updateSettings({ hideEmptyCourses: v })} />
        </div>
      </Section>

      <Section header="Advanced" footer="Only needed if an access key was set for your relay. Leave blank otherwise.">
        <label className="row field-row">
          <span className="row-title">Relay Key</span>
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
        <button className="row" onClick={() => setConfirmErase(true)}>
          <span className="row-title danger center-text">Sign Out</span>
        </button>
      </Section>

      <p className="about">
        Your password and marks are stored only on this device. Each sync goes through your own private relay straight to ta.yrdsb.ca; the relay keeps nothing.
        <br />
        Not affiliated with YRDSB or the teachassist foundation.
      </p>

      {pinFlow !== null && (
      <Sheet title={pinFlow === 'confirm' ? 'Confirm PIN' : 'New PIN'} onClose={() => setPinFlow(null)}>
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
      )}

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
