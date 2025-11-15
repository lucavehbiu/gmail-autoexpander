/**
 * Type definitions for Gmail Auto-Expander
 */

export interface ExtensionSettings {
  autoExpandEnabled: boolean;
  debugMode: boolean;
  errorReportingEnabled: boolean;
  expandCount: number;
  lastExpanded: string | null;
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
};
