import { ExtensionSettings, DEFAULT_SETTINGS } from '../types';

/**
 * Chrome Storage API utilities
 */

export const storage = {
  /**
   * Get settings from Chrome storage
   * Uses both sync (for settings) and local (for usage tracking to prevent incognito bypass)
   */
  async getSettings(): Promise<ExtensionSettings> {
    try {
      // Get user settings from sync (syncs across devices)
      const syncData = await chrome.storage.sync.get({
        autoExpandEnabled: DEFAULT_SETTINGS.autoExpandEnabled,
        debugMode: DEFAULT_SETTINGS.debugMode,
        errorReportingEnabled: DEFAULT_SETTINGS.errorReportingEnabled,
      });

      // Get usage tracking from local (persists in incognito)
      const localData = await chrome.storage.local.get({
        expandCount: DEFAULT_SETTINGS.expandCount,
        lastExpanded: DEFAULT_SETTINGS.lastExpanded,
        dailyExpandCount: DEFAULT_SETTINGS.dailyExpandCount,
        lastResetDate: DEFAULT_SETTINGS.lastResetDate,
      });

      const settings = { ...syncData, ...localData } as ExtensionSettings;

      // Check if we need to reset daily count
      const today = new Date().toISOString().split('T')[0];
      if (settings.lastResetDate !== today) {
        settings.dailyExpandCount = 0;
        settings.lastResetDate = today;
        await chrome.storage.local.set({ dailyExpandCount: 0, lastResetDate: today });
      }

      return settings;
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
      dailyExpandCount: settings.dailyExpandCount + 1,
      lastExpanded: new Date().toISOString(),
    });
  },

  /**
   * Check if user can expand (within free limit)
   */
  async canExpand(): Promise<boolean> {
    const settings = await this.getSettings();
    const FREE_DAILY_LIMIT = 5;
    return settings.dailyExpandCount < FREE_DAILY_LIMIT;
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
