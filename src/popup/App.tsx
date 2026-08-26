/**
 * Main Popup Component
 */

import React, { useEffect, useState } from 'react';
import { storage } from '../utils/storage';
import { ExtensionSettings, FREE_DAILY_LIMIT } from '../types';

type Status = { tone: 'ok' | 'error'; text: string } | null;

/**
 * "Yesterday" carries more than "8/25/2026" and fits the column without
 * shrinking the type next to a plain count.
 */
function formatLastExpanded(iso: string | null): string {
  if (!iso) return '—';

  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return '—';

  const startOfDay = (d: Date) =>
    new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round(
    (startOfDay(new Date()) - startOfDay(then)) / 86_400_000
  );

  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;

  return then.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/**
 * Look a license up by the email it was bought with.
 *
 * Used in two places, for two different people: someone who never entered
 * their key, and someone whose stored key stopped validating because it was
 * issued before licenses were recorded. Same mechanism, different framing.
 */
const RecoverByEmail: React.FC<{
  label: string;
  onRecovered: () => void;
}> = ({ label, onRecovered }) => {
  const [email, setEmail] = useState('');
  const [working, setWorking] = useState(false);
  const [status, setStatus] = useState<Status>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setWorking(true);
    setStatus(null);

    try {
      const response = await chrome.runtime.sendMessage({
        type: 'RECOVER_LICENSE',
        email,
      });

      if (response?.success) {
        setStatus({ tone: 'ok', text: 'Found it. Premium restored.' });
        onRecovered();
      } else {
        setStatus({ tone: 'error', text: response?.error || 'Lookup failed.' });
      }
    } catch {
      setStatus({ tone: 'error', text: 'Lookup failed. Try again.' });
    } finally {
      setWorking(false);
    }
  };

  return (
    <form className="field" onSubmit={submit}>
      <label className="field-label" htmlFor="recover-email">
        {label}
      </label>
      <div className="field-row">
        <input
          id="recover-email"
          type="email"
          className="input"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          autoComplete="email"
          disabled={working}
        />
        <button type="submit" className="btn btn-quiet" disabled={working}>
          {working ? 'Looking' : 'Find key'}
        </button>
      </div>
      {status && (
        <p className={`note note-${status.tone}`} role="status">
          {status.text}
        </p>
      )}
    </form>
  );
};

const App: React.FC = () => {
  const [settings, setSettings] = useState<ExtensionSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [licenseKey, setLicenseKey] = useState('');
  const [activating, setActivating] = useState(false);
  const [activation, setActivation] = useState<Status>(null);
  const [recovering, setRecovering] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    const data = await storage.getSettings();
    setSettings(data);
  };

  const updateSetting = async (key: keyof ExtensionSettings, value: any) => {
    if (!settings) return;

    setSaving(true);
    setSettings({ ...settings, [key]: value });

    try {
      await storage.saveSettings({ [key]: value });
    } catch (error) {
      console.error('Failed to save setting:', error);
    } finally {
      setTimeout(() => setSaving(false), 900);
    }
  };

  const handleReset = async () => {
    if (!confirm('Reset preferences and counters? Your license is kept.')) {
      return;
    }

    try {
      await storage.resetSettings();
      await loadSettings();
    } catch (error) {
      console.error('Failed to reset settings:', error);
    }
  };

  const handleUpgrade = () => {
    chrome.runtime.sendMessage({ type: 'OPEN_UPGRADE' });
  };

  const handleActivateLicense = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!licenseKey.trim()) {
      setActivation({ tone: 'error', text: 'Enter your license key first.' });
      return;
    }

    setActivating(true);
    setActivation(null);

    try {
      const response = await chrome.runtime.sendMessage({
        type: 'ACTIVATE_PREMIUM',
        licenseKey: licenseKey.trim(),
      });

      if (response?.success) {
        setLicenseKey('');
        await loadSettings();
      } else {
        // Surface the backend's reason. "not valid" and "couldn't reach the
        // server" call for different things from the person reading it, and
        // the message stays put until they try again rather than timing out
        // from under them.
        setActivation({
          tone: 'error',
          text: response?.error || 'Could not activate that key.',
        });
      }
    } catch (error) {
      console.error('Activation error:', error);
      setActivation({ tone: 'error', text: 'Could not activate that key.' });
    } finally {
      setActivating(false);
    }
  };

  if (!settings) {
    return (
      <div className="popup popup-loading">
        <span className="loading-mark" aria-label="Loading" />
      </div>
    );
  }

  const used = Math.min(settings.dailyExpandCount, FREE_DAILY_LIMIT);
  const atLimit = settings.dailyExpandCount >= FREE_DAILY_LIMIT;

  return (
    <div className="popup">
      <header className="masthead">
        <img className="mark" src="/icons/icon-48.png" alt="" />
        <div className="masthead-text">
          <h1>Gmail Unlimited</h1>
          <p>Auto-expands clipped messages</p>
        </div>
        <span className="version">{chrome.runtime.getManifest().version}</span>
      </header>

      {settings.licenseNeedsAttention && (
        <section className="band band-attention">
          <h2 className="band-title">Confirm your license</h2>
          <p className="band-body">
            Your key was issued before we started recording them, so we
            can&rsquo;t verify it. Premium stays on. Look up your current key
            with the email you paid with and this goes away for good.
          </p>
          <RecoverByEmail
            label="Purchase email"
            onRecovered={() => {
              setRecovering(false);
              loadSettings();
            }}
          />
        </section>
      )}

      <section className="controls" aria-label="Settings">
        <div className="control">
          <div className="control-text">
            <label htmlFor="autoExpand">Auto-expand clipped messages</label>
            <span>Expand long emails the moment you open them</span>
          </div>
          <label className="switch">
            <input
              id="autoExpand"
              type="checkbox"
              checked={settings.autoExpandEnabled}
              onChange={(e) => updateSetting('autoExpandEnabled', e.target.checked)}
            />
            <span className="switch-track" />
          </label>
        </div>

        <div className="control">
          <div className="control-text">
            <label htmlFor="debugMode">Debug mode</label>
            <span>Log what the extension is doing to the console</span>
          </div>
          <label className="switch">
            <input
              id="debugMode"
              type="checkbox"
              checked={settings.debugMode}
              onChange={(e) => updateSetting('debugMode', e.target.checked)}
            />
            <span className="switch-track" />
          </label>
        </div>

        <div className="control">
          <div className="control-text">
            <label htmlFor="errorReporting">Error reporting</label>
            <span>Send crash details only. Off unless you turn it on</span>
          </div>
          <label className="switch">
            <input
              id="errorReporting"
              type="checkbox"
              checked={settings.errorReportingEnabled}
              onChange={(e) =>
                updateSetting('errorReportingEnabled', e.target.checked)
              }
            />
            <span className="switch-track" />
          </label>
        </div>
      </section>

      {settings.isPremium ? (
        <section className="band" aria-label="License">
          <div className="plan">
            <span className="plan-name">Unlimited</span>
            <span className="plan-state plan-state-on">Active</span>
          </div>
          {settings.licenseKey && (
            <div className="keyline">
              <span className="keyline-label">License key</span>
              <code className="keyline-value">{settings.licenseKey}</code>
            </div>
          )}
        </section>
      ) : (
        <section className="band" aria-label="Daily usage">
          <div className="plan">
            <span className="plan-name">Free</span>
            <span className="plan-state">
              <strong>{used}</strong> of {FREE_DAILY_LIMIT} today
            </span>
          </div>

          <div
            className="meter"
            role="meter"
            aria-valuenow={used}
            aria-valuemin={0}
            aria-valuemax={FREE_DAILY_LIMIT}
            aria-label="Expansions used today"
          >
            {Array.from({ length: FREE_DAILY_LIMIT }, (_, i) => (
              <span
                key={i}
                className={`tick${i < used ? ' tick-spent' : ''}`}
              />
            ))}
          </div>

          <p className="band-body">
            {atLimit
              ? "That's today's five. Unlimited is a one-time $2.99."
              : 'Unlimited expansions, one payment of $2.99, no subscription.'}
          </p>

          <button className="btn btn-loud" onClick={handleUpgrade}>
            Get unlimited
          </button>

          <form className="field" onSubmit={handleActivateLicense}>
            <label className="field-label" htmlFor="licenseKey">
              Already bought it? Paste your key
            </label>
            <div className="field-row">
              <input
                id="licenseKey"
                type="text"
                className="input input-key"
                value={licenseKey}
                onChange={(e) => setLicenseKey(e.target.value)}
                placeholder="GM-0000-0000-0000-0000-0000-0000"
                spellCheck={false}
                autoComplete="off"
                disabled={activating}
              />
              <button type="submit" className="btn btn-quiet" disabled={activating}>
                {activating ? 'Checking' : 'Activate'}
              </button>
            </div>
            {activation && (
              <p className={`note note-${activation.tone}`} role="alert">
                {activation.text}
              </p>
            )}
          </form>

          {recovering ? (
            <RecoverByEmail
              label="Email you paid with"
              onRecovered={() => {
                setRecovering(false);
                loadSettings();
              }}
            />
          ) : (
            <button className="link" onClick={() => setRecovering(true)}>
              Lost your key?
            </button>
          )}
        </section>
      )}

      <section className="ledger" aria-label="Statistics">
        <div className="stat">
          <span className="stat-value">{settings.expandCount}</span>
          <span className="stat-label">Messages expanded</span>
        </div>
        <div className="stat">
          <span className="stat-value">
            {formatLastExpanded(settings.lastExpanded)}
          </span>
          <span className="stat-label">Last expanded</span>
        </div>
      </section>

      <footer className="footer">
        <button className="link link-muted" onClick={handleReset}>
          Reset preferences
        </button>
        <span className={`saved${saving ? ' saved-on' : ''}`} aria-live="polite">
          {saving ? 'Saved' : ''}
        </span>
      </footer>
    </div>
  );
};

export default App;
