/**
 * Service for managing pending deletion/disable states
 * Implements implicit two-step confirmation via repeated function calls
 */

interface PendingDeletion {
  userId: string;
  operation: 'deleteTransactions' | 'disableRecurringTransactions';
  ids: string[];
  createdAt: Date;
  expiresAt: Date;
  summaries: any[];
}

type PendingState = 'NONE' | 'PENDING_VALID' | 'PENDING_EXPIRED';

export class DeletionStateService {
  private pendingDeletions: Map<string, PendingDeletion>;
  private readonly CONFIRMATION_WINDOW_SECONDS: number;
  private cleanupInterval: NodeJS.Timeout;

  constructor(confirmationWindowSeconds: number = 120) {
    this.pendingDeletions = new Map();
    this.CONFIRMATION_WINDOW_SECONDS = confirmationWindowSeconds;
    
    // Cleanup expired states every minute
    this.cleanupInterval = setInterval(() => this.cleanupExpiredStates(), 60000);
  }

  /**
   * Generate a unique state key from userId, operation, and sorted IDs
   * This ensures order-independent matching
   */
  private getStateKey(userId: string, operation: string, ids: string[]): string {
    const sortedIds = [...ids].sort().join(',');
    return `${userId}:${operation}:${sortedIds}`;
  }

  /**
   * Check if there's a pending deletion for these exact parameters
   * @returns State status and summaries if pending
   */
  checkPendingState(
    userId: string,
    operation: 'deleteTransactions' | 'disableRecurringTransactions',
    ids: string[]
  ): { state: PendingState; summaries?: any[] } {
    const key = this.getStateKey(userId, operation, ids);
    const pending = this.pendingDeletions.get(key);

    if (!pending) {
      return { state: 'NONE' };
    }

    const now = new Date();
    if (now > pending.expiresAt) {
      return { state: 'PENDING_EXPIRED', summaries: pending.summaries };
    }

    return { state: 'PENDING_VALID', summaries: pending.summaries };
  }

  /**
   * Create or refresh pending deletion state
   * @param userId User ID
   * @param operation Operation type
   * @param ids Transaction/Recurring Transaction IDs
   * @param summaries Transaction summaries for display
   */
  createPendingState(
    userId: string,
    operation: 'deleteTransactions' | 'disableRecurringTransactions',
    ids: string[],
    summaries: any[]
  ): void {
    const key = this.getStateKey(userId, operation, ids);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.CONFIRMATION_WINDOW_SECONDS * 1000);

    this.pendingDeletions.set(key, {
      userId,
      operation,
      ids: [...ids].sort(), // Store sorted for consistency
      createdAt: now,
      expiresAt,
      summaries,
    });

    console.log(
      `[DeletionStateService] Created pending ${operation} for user ${userId} ` +
      `with ${ids.length} ID(s), expires at ${expiresAt.toISOString()}`
    );
  }

  /**
   * Clear pending state after execution or when expired
   */
  clearPendingState(
    userId: string,
    operation: 'deleteTransactions' | 'disableRecurringTransactions',
    ids: string[]
  ): void {
    const key = this.getStateKey(userId, operation, ids);
    const deleted = this.pendingDeletions.delete(key);
    
    if (deleted) {
      console.log(`[DeletionStateService] Cleared pending ${operation} for user ${userId}`);
    }
  }

  /**
   * Periodic cleanup of expired states
   */
  private cleanupExpiredStates(): void {
    const now = new Date();
    let cleanedCount = 0;

    for (const [key, pending] of this.pendingDeletions.entries()) {
      if (now > pending.expiresAt) {
        this.pendingDeletions.delete(key);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      console.log(`[DeletionStateService] Cleaned up ${cleanedCount} expired pending state(s)`);
    }
  }

  /**
   * Get current pending deletions count (for monitoring/debugging)
   */
  getPendingCount(): number {
    return this.pendingDeletions.size;
  }

  /**
   * Cleanup on service shutdown
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.pendingDeletions.clear();
  }
}

// Singleton instance
export const deletionStateService = new DeletionStateService();
