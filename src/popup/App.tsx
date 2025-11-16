/**
 * Main Popup Component
 */

import React, { useEffect, useState } from 'react';
import { storage } from '../utils/storage';
import { ExtensionSettings, FREE_DAILY_LIMIT } from '../types';

const App: React.FC = () => {
  const [settings, setSettings] = useState<ExtensionSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [licenseKey, setLicenseKey] = useState('');
  const [activating, setActivating] = useState(false);
  const [activationMessage, setActivationMessage] = useState('');

  // Load settings on mount
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
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);

    try {
      await storage.saveSettings({ [key]: value });
    } catch (error) {
      console.error('Failed to save setting:', error);
    } finally {
      setTimeout(() => setSaving(false), 300);
    }
  };

  const handleReset = async () => {
    if (!confirm('Reset all settings to default? This cannot be undone.')) {
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

  const handleActivateLicense = async () => {
    if (!licenseKey.trim()) {
      setActivationMessage('Please enter a license key');
      return;
    }

    setActivating(true);
    setActivationMessage('');

    try {
      const response = await chrome.runtime.sendMessage({
        type: 'ACTIVATE_PREMIUM',
        licenseKey: licenseKey.trim()
      });

      if (response.success) {
        setActivationMessage('License activated successfully! ✓');
        setLicenseKey('');
        await loadSettings(); // Reload to show premium status
      } else {
        setActivationMessage('Failed to activate license');
      }
    } catch (error) {
      console.error('Activation error:', error);
      setActivationMessage('Error activating license');
    } finally {
      setActivating(false);
      setTimeout(() => setActivationMessage(''), 3000);
    }
  };

  if (!settings) {
    return (
      <div className="popup-container loading">
        <div className="spinner"></div>
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className="popup-container">
      {/* Header */}
      <header className="popup-header">
        <div className="header-content">
          <img src="/icons/icon-48.png" alt="Gmail Unlimited" style={{width: '24px', height: '24px', marginRight: '8px'}} />
          <h1>Gmail Unlimited</h1>
          <span className="version">v1.0.0</span>
        </div>
        <p className="subtitle">Auto-expand clipped messages</p>
      </header>

      {/* Settings */}
      <div className="settings-section">
        {/* Auto-expand Toggle */}
        <div className="setting-item">
          <div className="setting-info">
            <label htmlFor="autoExpand">Auto-expand clipped messages</label>
            <span className="setting-desc">
              Automatically expand emails when you open them
            </span>
          </div>
          <label className="toggle">
            <input
              id="autoExpand"
              type="checkbox"
              checked={settings.autoExpandEnabled}
              onChange={(e) => updateSetting('autoExpandEnabled', e.target.checked)}
            />
            <span className="slider"></span>
          </label>
        </div>

        {/* Debug Mode */}
        <div className="setting-item">
          <div className="setting-info">
            <label htmlFor="debugMode">Debug mode</label>
            <span className="setting-desc">
              Show detailed logs in browser console
            </span>
          </div>
          <label className="toggle">
            <input
              id="debugMode"
              type="checkbox"
              checked={settings.debugMode}
              onChange={(e) => updateSetting('debugMode', e.target.checked)}
            />
            <span className="slider"></span>
          </label>
        </div>

        {/* Error Reporting */}
        <div className="setting-item">
          <div className="setting-info">
            <label htmlFor="errorReporting">Error reporting</label>
            <span className="setting-desc">
              Help improve the extension (privacy-first, opt-in)
            </span>
          </div>
          <label className="toggle">
            <input
              id="errorReporting"
              type="checkbox"
              checked={settings.errorReportingEnabled}
              onChange={(e) => updateSetting('errorReportingEnabled', e.target.checked)}
            />
            <span className="slider"></span>
          </label>
        </div>
      </div>

      {/* Premium Status or Daily Usage */}
      {settings.isPremium ? (
        <div className="premium-section">
          <div className="premium-badge">
            <span className="premium-icon">✓</span>
            <div>
              <div className="premium-title">Premium Active</div>
              <div className="premium-subtitle">Unlimited expansions forever</div>
            </div>
          </div>
          {settings.licenseKey && (
            <div style={{
              marginTop: '12px',
              padding: '12px',
              backgroundColor: '#f8f9fa',
              borderRadius: '8px',
              border: '1px solid #e8eaed'
            }}>
              <div style={{ fontSize: '11px', color: '#5f6368', marginBottom: '4px' }}>
                License Key
              </div>
              <div style={{
                fontSize: '12px',
                fontFamily: 'monospace',
                color: '#202124',
                wordBreak: 'break-all'
              }}>
                {settings.licenseKey}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="usage-section">
          <h3>Daily Usage (Free)</h3>
          <div className="usage-bar">
            <div className="usage-fill" style={{ width: `${(settings.dailyExpandCount / FREE_DAILY_LIMIT) * 100}%` }}></div>
          </div>
          <p className="usage-text">{settings.dailyExpandCount} / {FREE_DAILY_LIMIT} expansions today</p>
          {settings.dailyExpandCount >= FREE_DAILY_LIMIT && (
            <p className="usage-limit">Daily limit reached! Upgrade for unlimited expansions.</p>
          )}
          <button className="btn-upgrade" onClick={handleUpgrade}>
            Upgrade to Unlimited - $2.99
          </button>

          {/* License Key Activation */}
          <div className="license-activation" style={{ marginTop: '16px' }}>
            <div style={{ fontSize: '13px', color: '#666', marginBottom: '8px' }}>
              Already purchased? Enter your license key:
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type="text"
                value={licenseKey}
                onChange={(e) => setLicenseKey(e.target.value)}
                placeholder="GM-XXXX-XXXX-XXXX-XXXX-XXXX"
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  border: '1px solid #ddd',
                  borderRadius: '6px',
                  fontSize: '13px',
                  fontFamily: 'monospace'
                }}
                disabled={activating}
              />
              <button
                onClick={handleActivateLicense}
                disabled={activating}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#34a853',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '13px',
                  fontWeight: '500',
                  cursor: activating ? 'not-allowed' : 'pointer',
                  opacity: activating ? 0.6 : 1
                }}
              >
                {activating ? 'Activating...' : 'Activate'}
              </button>
            </div>
            {activationMessage && (
              <div style={{
                marginTop: '8px',
                fontSize: '12px',
                color: activationMessage.includes('✓') ? '#34a853' : '#d93025'
              }}>
                {activationMessage}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Statistics */}
      <div className="stats-section">
        <h3>Statistics</h3>
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-value">{settings.expandCount}</div>
            <div className="stat-label">Total Expanded</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">
              {settings.lastExpanded
                ? new Date(settings.lastExpanded).toLocaleDateString()
                : 'Never'}
            </div>
            <div className="stat-label">Last Expanded</div>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="actions-section">
        <button className="btn-reset" onClick={handleReset}>
          Reset Settings
        </button>
      </div>

      {/* Footer */}
      <footer className="popup-footer">
        <p>Made for Gmail users who hate clicking</p>
        <div className="footer-links">
          <a href="https://github.com/your-repo" target="_blank" rel="noopener noreferrer">
            GitHub
          </a>
          <span>•</span>
          <a href="https://your-support.com" target="_blank" rel="noopener noreferrer">
            Support
          </a>
        </div>
      </footer>

      {/* Save Indicator */}
      {saving && (
        <div className="save-indicator">
          Saved ✓
        </div>
      )}
    </div>
  );
};

export default App;
