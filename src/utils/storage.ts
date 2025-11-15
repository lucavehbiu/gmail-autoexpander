import { ExtensionSettings, DEFAULT_SETTINGS } from '../types';

/**
 * Chrome Storage API utilities
 */

export const storage = {
  /**
   * Get settings from Chrome storage
   */
  async getSettings(): Promise<ExtensionSettings> {
    try {
      const data = await chrome.storage.sync.get(DEFAULT_SETTINGS);
      return data as ExtensionSettings;
    } catch (error) {
      console.error('[Storage] Failed to get settings:', error);
      return DEFAULT_SETTINGS;
    }
  },

  /**
   * Save settings to Chrome storage
   */
  async saveSettings(settings: Partial<ExtensionSettings>): Promise<void> {
    try {
      await chrome.storage.sync.set(settings);
    } catch (error) {
      console.error('[Storage] Failed to save settings:', error);
      throw error;
    }
  },

  /**
   * Increment expansion counter
   */
  async incrementExpansionCount(): Promise<void> {
    const settings = await this.getSettings();
    await this.saveSettings({
      expandCount: settings.expandCount + 1,
      lastExpanded: new Date().toISOString(),
    });
  },

  /**
   * Reset all settings to default
   */
  async resetSettings(): Promise<void> {
    try {
      await chrome.storage.sync.clear();
      await chrome.storage.sync.set(DEFAULT_SETTINGS);
    } catch (error) {
      console.error('[Storage] Failed to reset settings:', error);
      throw error;
    }
  },

  /**
   * Listen for storage changes
   */
  onChanged(callback: (changes: { [key: string]: chrome.storage.StorageChange }) => void): void {
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName === 'sync') {
        callback(changes);
      }
    });
  },
};
