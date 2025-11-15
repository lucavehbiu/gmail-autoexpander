import { storage } from './storage';

/**
 * Debug logger that respects user settings
 */
class Logger {
  private debugEnabled = false;

  async init() {
    const settings = await storage.getSettings();
    this.debugEnabled = settings.debugMode;

    // Listen for settings changes
    storage.onChanged((changes) => {
      if (changes.debugMode) {
        this.debugEnabled = changes.debugMode.newValue;
      }
    });
  }

  log(...args: any[]) {
    if (this.debugEnabled) {
      console.log('[Gmail Expander]', ...args);
    }
  }

  warn(...args: any[]) {
    if (this.debugEnabled) {
      console.warn('[Gmail Expander]', ...args);
    }
  }

  error(...args: any[]) {
    console.error('[Gmail Expander]', ...args);
  }

  success(...args: any[]) {
    if (this.debugEnabled) {
      console.log('[Gmail Expander] ✓', ...args);
    }
  }
}

export const logger = new Logger();
