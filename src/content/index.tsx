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

  // Main content area (multiple selectors for different Gmail views)
  MAIN_CONTENT: [
    'div[role="main"]',     // Standard Gmail view
    '.nH',                  // Gmail container
    'body',                 // Fallback: entire body
  ],
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

  // Wait a bit for Gmail to fully load
  await new Promise(resolve => setTimeout(resolve, 1000));

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

  // Try each selector until we find content
  let mainContent: Element | null = null;
  for (const selector of SELECTORS.MAIN_CONTENT) {
    mainContent = document.querySelector(selector);
    if (mainContent) {
      logger.log(`Found content area using selector: ${selector}`);
      break;
    }
  }

  if (!mainContent) {
    logger.warn('Main content area not found with any selector');
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

    // Get the URL and fetch the full content
    if (button instanceof HTMLAnchorElement && button.href) {
      // Check if we're already on the full email view page
      const currentUrl = window.location.href;
      logger.log(`Current URL: ${currentUrl}`);
      logger.log(`Expand button URL: ${button.href}`);

      const isFullView = currentUrl.includes('view=lg') ||
                        currentUrl.includes('view=om') ||
                        currentUrl.includes('permmsgid=');

      logger.log(`Is full view page: ${isFullView}`);

      if (isFullView) {
        // We're already on the full view page
        logger.log('Already on full email view, removing clipped indicator...');

        // Find and remove the clipped indicator
        const clippedDiv = container.querySelector('.iX');
        if (clippedDiv) {
          clippedDiv.remove();
          logger.success('Removed "[Message clipped]" indicator - full content is already visible!');
        } else {
          logger.log('No clipped indicator found - content may already be expanded');
        }

        await storage.incrementExpansionCount();
        markAsExpanded(container);
        return;
      }

      // We're in inbox view - fetch and inject inline
      logger.log('Fetching full email content for inline injection...');
      const response = await fetch(button.href);
      const html = await response.text();

      // Parse the HTML
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');

      // Find the email body in the fetched page - try multiple selectors
      // The view=lg page uses old HTML table structure with .maincontent class
      const fullEmailBody = doc.querySelector('.maincontent') || // view=lg page structure
                           doc.querySelector('.a3s.aiL') ||
                           doc.querySelector('.a3s') ||
                           doc.querySelector('.ii.gt') || // Gmail message body container
                           doc.querySelector('[role="article"]') ||
                           doc.querySelector('.message_body');

      logger.log(`Tried selectors - found element: ${!!fullEmailBody}`);

      if (fullEmailBody) {
        logger.log('Found full email content, injecting inline...');
        logger.log(`Content length: ${fullEmailBody.innerHTML.length} chars`);

        // Find the container where clipped content is
        const clippedContainer = container.querySelector('.a3s.aiL') ||
                                container.querySelector('.a3s');

        if (clippedContainer) {
          // Replace clipped content with full content
          clippedContainer.innerHTML = fullEmailBody.innerHTML;

          // Add visual indicator and styling
          const wrapper = document.createElement('div');
          wrapper.style.cssText = `
            background: #f8f9fa;
            padding: 16px;
            border-radius: 8px;
            margin-top: 8px;
            border-left: 4px solid #1a73e8;
          `;

          // Wrap the content
          const parent = clippedContainer.parentElement;
          if (parent) {
            parent.insertBefore(wrapper, clippedContainer);
            wrapper.appendChild(clippedContainer);
          }

          // Remove the "[Message clipped]" text and button
          const clippedDiv = container.querySelector('.iX');
          if (clippedDiv) {
            clippedDiv.remove();
          }

          logger.success('Message expanded inline successfully!');
          await storage.incrementExpansionCount();
          markAsExpanded(container);
          return;
        }
      }

      logger.warn('Could not extract email content from fetched page');
      logger.log('Available body classes:', Array.from(doc.querySelectorAll('div[class*="a"]')).slice(0, 5).map(el => el.className));
      logger.log('HTML structure preview:', doc.body?.innerHTML.substring(0, 500));

      // Don't navigate - just remove the clipped indicator if present
      const clippedDiv = container.querySelector('.iX');
      if (clippedDiv) {
        clippedDiv.remove();
      }
      return;
    }

    // Fallback: click if it's not a link
    button.click();
    rateLimiter.recordExpansion();

    logger.error('No link found to expand');
    expandedMessages.delete(messageId); // Allow retry
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
