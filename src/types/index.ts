/**
 * Type definitions for Gmail Auto-Expander
 */

export interface ExtensionSettings {
  autoExpandEnabled: boolean;
  debugMode: boolean;
  errorReportingEnabled: boolean;
  expandCount: number;
  lastExpanded: string | null;
  // Free version tracking
  dailyExpandCount: number;
  lastResetDate: string;
  // Premium
  isPremium: boolean;
  licenseKey: string | null;
  /**
   * True once the backend has confirmed this key at least once.
   *
   * Keys sold before licences were stored exist in no database, so they can
   * never validate. Only a key that HAS validated before may be revoked on a
   * later failure — that is a real refund. A key that has never validated is
   * a legacy purchase, and the customer is offered recovery instead of being
   * silently downgraded.
   */
  licenseVerified: boolean;
  /** A stored key stopped validating and the customer needs to recover it. */
  licenseNeedsAttention: boolean;
}

export interface ExpansionStats {
  totalExpanded: number;
  todayExpanded: number;
  lastExpandedSender: string | null;
  lastExpandedTime: number | null;
}

export interface ErrorReport {
  timestamp: number;
  message: string;
  stack?: string;
  context: 'content' | 'popup' | 'background';
}

export interface RateLimiter {
  count: number;
  windowStart: number;
  maxPerSecond: number;
}

export const DEFAULT_SETTINGS: ExtensionSettings = {
  autoExpandEnabled: true,
  debugMode: false,
  errorReportingEnabled: false,
  expandCount: 0,
  lastExpanded: null,
  dailyExpandCount: 0,
  lastResetDate: new Date().toISOString().split('T')[0],
  isPremium: false,
  licenseKey: null,
  licenseVerified: false,
  licenseNeedsAttention: false,
};

export const FREE_DAILY_LIMIT = 5;
