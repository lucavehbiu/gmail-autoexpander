import { RateLimiter } from '../types';

/**
 * Rate limiter to prevent spam expansions
 * Limits to 5 expansions per second
 */
class ExpansionRateLimiter {
  private state: RateLimiter = {
    count: 0,
    windowStart: Date.now(),
    maxPerSecond: 5,
  };

  /**
   * Check if expansion is allowed
   * Returns true if within rate limit, false otherwise
   */
  canExpand(): boolean {
    const now = Date.now();
    const windowElapsed = now - this.state.windowStart;

    // Reset window if more than 1 second has passed
    if (windowElapsed >= 1000) {
      this.state.count = 0;
      this.state.windowStart = now;
    }

    // Check if we've hit the limit
    if (this.state.count >= this.state.maxPerSecond) {
      return false;
    }

    return true;
  }

  /**
   * Record an expansion attempt
   */
  recordExpansion(): void {
    this.state.count++;
  }

  /**
   * Get current rate limit status
   */
  getStatus(): { remaining: number; resetIn: number } {
    const now = Date.now();
    const windowElapsed = now - this.state.windowStart;
    const remaining = Math.max(0, this.state.maxPerSecond - this.state.count);
    const resetIn = Math.max(0, 1000 - windowElapsed);

    return { remaining, resetIn };
  }
}

export const rateLimiter = new ExpansionRateLimiter();
