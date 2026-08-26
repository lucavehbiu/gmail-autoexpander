/**
 * Background Service Worker
 * Handles extension lifecycle events
 */

import { DEFAULT_SETTINGS } from '../types';
import { API_BASE, recoverLicense, validateLicenseKey } from '../utils/license';

// Initialize extension on install
chrome.runtime.onInstalled.addListener(async (details) => {
  console.log('[Background] Extension installed:', details.reason);

  if (details.reason === 'install') {
    // Seed only the keys that are actually missing.
    //
    // chrome.storage.sync is shared across the whole Chrome profile, so a
    // customer installing on a second machine fires 'install' there too.
    // Writing DEFAULT_SETTINGS wholesale would overwrite isPremium and
    // licenseKey with defaults and sync that erasure back to every device.
    const existing = await chrome.storage.sync.get(null);
    const missing = Object.fromEntries(
      Object.entries(DEFAULT_SETTINGS).filter(([key]) => !(key in existing))
    );

    if (Object.keys(missing).length > 0) {
      await chrome.storage.sync.set(missing);
    }
    console.log('[Background] Default settings initialized');

    // Open welcome page (optional)
    // chrome.tabs.create({ url: 'https://your-welcome-page.com' });
  } else if (details.reason === 'update') {
    // Handle updates
    console.log('[Background] Extension updated to version', chrome.runtime.getManifest().version);

    // An update is the first moment a pre-licensing customer meets validation.
    // Check now so the popup can offer recovery instead of just going quiet.
    revalidateStoredLicense().catch((error) =>
      console.error('[Background] Post-update revalidation failed:', error)
    );
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
  } else if (message.type === 'OPEN_UPGRADE') {
    // Open hosted payment page in new tab
    const extensionId = chrome.runtime.id;
    const upgradeUrl = `${API_BASE}/upgrade.html?ext_id=${extensionId}`;
    chrome.tabs.create({ url: upgradeUrl });
    sendResponse({ success: true });
  } else if (message.type === 'ACTIVATE_PREMIUM') {
    // Activate premium with license key (from hosted page or internal)
    activatePremium(message.licenseKey).then(sendResponse);
    return true; // Indicate async response
  } else if (message.type === 'RECOVER_LICENSE') {
    recoverAndActivate(message.email).then(sendResponse);
    return true; // Indicate async response
  }

  return false;
});

// Handle external messages (from hosted payment pages)
chrome.runtime.onMessageExternal.addListener((message, sender, sendResponse) => {
  console.log('[Background] Received external message:', message, 'from:', sender.url);

  if (message.type === 'ACTIVATE_PREMIUM' && message.licenseKey) {
    activatePremium(message.licenseKey).then(sendResponse);
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
  const data = await chrome.storage.local.get(['expandCount', 'lastExpanded']);
  return {
    expandCount: data.expandCount || 0,
    lastExpanded: data.lastExpanded || null,
  };
}

/**
 * Activate premium with license key
 */
async function activatePremium(licenseKey: string): Promise<any> {
  const key = String(licenseKey || '').trim().toUpperCase();

  if (!key) {
    return { success: false, error: 'Please enter a license key' };
  }

  const result = await validateLicenseKey(key);

  if (result.status === 'unreachable') {
    return {
      success: false,
      error: "Couldn't reach the license server. Check your connection and try again.",
    };
  }

  if (result.status === 'invalid') {
    return { success: false, error: 'That license key is not valid.' };
  }

  try {
    // Store premium status in sync (syncs across devices).
    //
    // licenseVerified records that the backend has confirmed this key at least
    // once. Revalidation only revokes keys carrying that mark, so a legacy key
    // that never existed server-side cannot cost a customer their premium.
    await chrome.storage.sync.set({
      isPremium: true,
      licenseKey: key,
      licenseVerified: true,
      licenseNeedsAttention: false,
    });

    console.log('[Background] Premium activated');
    return { success: true };
  } catch (error) {
    console.error('[Background] Failed to activate premium:', error);
    return { success: false, error: 'Failed to save your license locally.' };
  }
}

/**
 * Look a customer's key up by purchase email and activate it for them.
 */
async function recoverAndActivate(email: string): Promise<any> {
  const address = String(email || '').trim();

  if (!address.includes('@')) {
    return { success: false, error: 'Please enter the email you paid with.' };
  }

  const result = await recoverLicense(address);

  switch (result.status) {
    case 'found':
      // One purchase per customer is the norm; if there are several, the most
      // recent is first and any of them grants the same thing.
      return activatePremium(result.licenseKeys[0]);
    case 'not-found':
      return {
        success: false,
        error: 'No license found for that email. Use the address you paid with.',
      };
    case 'rate-limited':
      return { success: false, error: 'Too many attempts. Try again in an hour.' };
    default:
      return {
        success: false,
        error: "Couldn't reach the license server. Check your connection and try again.",
      };
  }
}

/**
 * Re-check the stored key when the browser starts, and once after an update.
 *
 * Without this a refunded key stays premium forever, since isPremium lives in
 * chrome.storage.sync and is never revisited.
 *
 * The downgrade rule is deliberately narrow. Only a key that has ALREADY
 * validated successfully may be revoked — that is a genuine refund. Keys sold
 * before the licensing backend existed were never written to any database and
 * can never validate, so treating "invalid" as "revoked" would strip premium
 * from every customer who bought before this shipped. Those are flagged for
 * recovery instead, and keep what they paid for in the meantime.
 *
 * An unreachable server changes nothing either way — a paying customer on a
 * plane keeps what they bought.
 */
async function revalidateStoredLicense(): Promise<void> {
  const { isPremium, licenseKey, licenseVerified } = await chrome.storage.sync.get({
    isPremium: false,
    licenseKey: null,
    licenseVerified: false,
  });

  if (!isPremium || !licenseKey) {
    return;
  }

  const result = await validateLicenseKey(licenseKey);

  if (result.status === 'valid') {
    await chrome.storage.sync.set({
      licenseVerified: true,
      licenseNeedsAttention: false,
    });
    return;
  }

  if (result.status === 'unreachable') {
    return;
  }

  if (licenseVerified) {
    console.log('[Background] Previously valid license was revoked, downgrading');
    await chrome.storage.sync.set({
      isPremium: false,
      licenseKey: null,
      licenseVerified: false,
      licenseNeedsAttention: false,
    });
    return;
  }

  console.log('[Background] Legacy license did not validate, flagging for recovery');
  await chrome.storage.sync.set({ licenseNeedsAttention: true });
}

chrome.runtime.onStartup.addListener(() => {
  revalidateStoredLicense().catch((error) =>
    console.error('[Background] Revalidation failed:', error)
  );
});

// Keep service worker alive (required for MV3)
// Service workers automatically terminate after 30 seconds of inactivity
// This is normal behavior and doesn't affect functionality
