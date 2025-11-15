/**
 * Background Service Worker
 * Handles extension lifecycle events
 */

import { DEFAULT_SETTINGS } from '../types';

// Initialize extension on install
chrome.runtime.onInstalled.addListener(async (details) => {
  console.log('[Background] Extension installed:', details.reason);

  if (details.reason === 'install') {
    // Set default settings on first install
    await chrome.storage.sync.set(DEFAULT_SETTINGS);
    console.log('[Background] Default settings initialized');

    // Open welcome page (optional)
    // chrome.tabs.create({ url: 'https://your-welcome-page.com' });
  } else if (details.reason === 'update') {
    // Handle updates
    console.log('[Background] Extension updated to version', chrome.runtime.getManifest().version);
  }
});

// Handle messages from content scripts or popup
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  console.log('[Background] Received message:', message);

  if (message.type === 'REPORT_ERROR' && message.data) {
    // Handle error reporting (if enabled)
    handleErrorReport(message.data);
    sendResponse({ success: true });
  } else if (message.type === 'GET_STATS') {
    // Get expansion statistics
    getStats().then(sendResponse);
    return true; // Indicate async response
  }

  return false;
});

/**
 * Handle error reports from content scripts
 */
async function handleErrorReport(error: any): Promise<void> {
  const settings = await chrome.storage.sync.get('errorReportingEnabled');

  if (!settings.errorReportingEnabled) {
    return; // User has opted out
  }

  console.error('[Background] Error reported:', error);

  // In production, you could send this to a logging service
  // For now, just log to console
  // Note: Always respect user privacy and make this opt-in!
}

/**
 * Get expansion statistics
 */
async function getStats(): Promise<any> {
  const data = await chrome.storage.sync.get(['expandCount', 'lastExpanded']);
  return {
    expandCount: data.expandCount || 0,
    lastExpanded: data.lastExpanded || null,
  };
}

// Keep service worker alive (required for MV3)
// Service workers automatically terminate after 30 seconds of inactivity
// This is normal behavior and doesn't affect functionality
