/**
 * Content Script - Main expansion logic for Gmail
 * Detects and auto-expands clipped messages
 */

import { storage } from '../utils/storage';
import { logger } from '../utils/logger';
import { rateLimiter } from '../utils/rateLimiter';

// Gmail selectors for clipped messages (updated for 2025)
const SELECTORS = {
  // Text indicators
  CLIPPED_TEXT: ['[Message clipped]', 'View entire message', 'Show trimmed content'],

  // Button selectors
  EXPAND_BUTTONS: [
    'a[href*="view=lg"]',           // Gmail's actual expand link (verified 2025)
    'a[href*="&view=full"]',        // Fallback: old Gmail format
    'div.iX a[target="_blank"]',    // Container class for clipped messages
    'button[aria-label*="entire message"]',
    'button[aria-label*="trimmed"]',
    'div[data-message-clipped="true"] a',
  ],

  // Message containers
  MESSAGE_CONTAINERS: [
    'div[role="article"]',
    'div[data-message-id]',
    'div.a3s', // Gmail message body class
  ],

  // Main content area
  MAIN_CONTENT: 'div[role="main"]',
};

// Track expanded messages to avoid re-expanding
const expandedMessages = new Set<string>();

// Retry configuration
const RETRY_CONFIG = {
  maxRetries: 2,
  retryDelay: 1000, // 1 second
  expansionTimeout: 3000, // 3 seconds
};

/**
 * Initialize the content script
 */
async function init() {
  await logger.init();
  logger.log('Content script initialized');

  const settings = await storage.getSettings();
  if (!settings.autoExpandEnabled) {
    logger.log('Auto-expand is disabled');
    return;
  }

  // Initial scan
  scanForClippedMessages();

  // Watch for new emails using MutationObserver
  startObserver();
}

/**
 * Scan the page for clipped messages
 */
function scanForClippedMessages(): void {
  logger.log('Scanning for clipped messages...');

  const mainContent = document.querySelector(SELECTORS.MAIN_CONTENT);
  if (!mainContent) {
    logger.warn('Main content area not found');
    return;
  }

  // Find all potential message containers
  const containers = Array.from(
    mainContent.querySelectorAll(SELECTORS.MESSAGE_CONTAINERS.join(', '))
  );

  let clippedCount = 0;

  containers.forEach((container) => {
    if (isMessageClipped(container as HTMLElement)) {
      clippedCount++;
      const expandButton = findExpandButton(container as HTMLElement);

      if (expandButton) {
        expandMessage(expandButton as HTMLElement, container as HTMLElement);
      } else {
        logger.warn('Clipped message detected but no expand button found');
      }
    }
  });

  logger.log(`Found ${clippedCount} clipped messages`);
}

/**
 * Check if a message container is clipped
 */
function isMessageClipped(container: HTMLElement): boolean {
  const text = container.innerText || container.textContent || '';

  return SELECTORS.CLIPPED_TEXT.some((indicator) =>
    text.includes(indicator)
  );
}

/**
 * Find the expand button in a container
 */
function findExpandButton(container: HTMLElement): HTMLElement | null {
  for (const selector of SELECTORS.EXPAND_BUTTONS) {
    const button = container.querySelector(selector);
    if (button) {
      return button as HTMLElement;
    }
  }
  return null;
}

/**
 * Expand a clipped message
 */
async function expandMessage(
  button: HTMLElement,
  container: HTMLElement,
  retryCount = 0
): Promise<void> {
  // Generate unique ID for this message
  const messageId = getMessageId(container);

  // Skip if already expanded
  if (expandedMessages.has(messageId)) {
    logger.log('Message already expanded, skipping');
    return;
  }

  // Check rate limit
  if (!rateLimiter.canExpand()) {
    const status = rateLimiter.getStatus();
    logger.warn(`Rate limit reached. ${status.remaining} remaining, reset in ${status.resetIn}ms`);

    // Wait and retry
    setTimeout(() => {
      expandMessage(button, container, retryCount);
    }, status.resetIn);
    return;
  }

  try {
    logger.log('Attempting to expand message...');

    // Mark as attempted immediately to prevent infinite loops
    expandedMessages.add(messageId);

    // Get the URL and navigate to it (don't open new tab)
    if (button instanceof HTMLAnchorElement && button.href) {
      logger.log('Navigating to full email view...');
      // Navigate to the full email view in the same tab
      window.location.href = button.href;
      rateLimiter.recordExpansion();
      await storage.incrementExpansionCount();
      logger.success('Navigated to full email view');
      return; // Exit immediately after navigation
    }

    // Fallback: click if it's not a link
    button.click();
    rateLimiter.recordExpansion();

    // Wait for Gmail to load content
    await new Promise((resolve) => setTimeout(resolve, 1500));

    // Check if expansion succeeded by looking for clipped text
    const stillClipped = isMessageClipped(container);
    const expanded = !stillClipped;

    if (expanded) {
      logger.success('Message expanded successfully');
      await storage.incrementExpansionCount();
      markAsExpanded(container);
    } else {
      // Retry if we haven't hit max retries
      if (retryCount < RETRY_CONFIG.maxRetries) {
        logger.warn(`Expansion may have failed, retrying... (${retryCount + 1}/${RETRY_CONFIG.maxRetries})`);
        // Remove from set so we can retry
        expandedMessages.delete(messageId);
        setTimeout(() => {
          expandMessage(button, container, retryCount + 1);
        }, RETRY_CONFIG.retryDelay);
      } else {
        logger.error('Max retries reached, expansion failed');
        // Keep in expandedMessages to prevent infinite retries
      }
    }
  } catch (error) {
    logger.error('Error during expansion:', error);

    // Retry on error
    if (retryCount < RETRY_CONFIG.maxRetries) {
      // Remove from set so we can retry
      expandedMessages.delete(messageId);
      setTimeout(() => {
        expandMessage(button, container, retryCount + 1);
      }, RETRY_CONFIG.retryDelay);
    } else {
      // Keep in expandedMessages to prevent infinite retries
      logger.error('Max retries reached after errors, giving up');
    }
  }
}

/**
 * Generate a unique ID for a message
 */
function getMessageId(container: HTMLElement): string {
  // Try to get Gmail's message ID
  const dataId = container.getAttribute('data-message-id');
  if (dataId) return dataId;

  // Fallback: use first 100 chars of text content as ID
  const text = (container.textContent || '').substring(0, 100);
  return btoa(text).substring(0, 32);
}

/**
 * Mark a message as expanded in the UI
 */
function markAsExpanded(container: HTMLElement): void {
  // Add a visual indicator
  const indicator = document.createElement('span');
  indicator.textContent = '✓ Expanded';
  indicator.style.cssText = `
    font-size: 11px;
    color: #1a73e8;
    background: #e8f0fe;
    padding: 2px 8px;
    border-radius: 12px;
    margin-left: 8px;
    font-weight: 500;
  `;
  indicator.setAttribute('data-gmail-expander', 'true');

  // Find a good place to insert it (try message header)
  const header = container.querySelector('[role="heading"]') ||
                 container.querySelector('.gs') ||
                 container.firstElementChild;

  if (header && !container.querySelector('[data-gmail-expander]')) {
    header.appendChild(indicator);
  }
}

/**
 * Start MutationObserver to watch for new emails
 */
function startObserver(): void {
  logger.log('Starting MutationObserver...');

  const observer = new MutationObserver(() => {
    // Debounce: only scan after mutations stop for 500ms
    clearTimeout((window as any).scanTimeout);
    (window as any).scanTimeout = setTimeout(() => {
      scanForClippedMessages();
    }, 500);
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });

  logger.log('MutationObserver started');
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

// Export for testing
export { scanForClippedMessages, isMessageClipped, expandMessage };
