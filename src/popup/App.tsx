/**
 * Main Popup Component
 */

import React, { useEffect, useState } from 'react';
import { storage } from '../utils/storage';
import { ExtensionSettings } from '../types';

const App: React.FC = () => {
  const [settings, setSettings] = useState<ExtensionSettings | null>(null);
  const [saving, setSaving] = useState(false);

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

      {/* Statistics */}
      <div className="stats-section">
        <h3>Statistics</h3>
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-value">{settings.expandCount}</div>
            <div className="stat-label">Messages Expanded</div>
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
