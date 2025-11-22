/**
 * Provides user context for operations
 * Encapsulates user ID resolution logic
 */
export class UserContextProvider {
  private userId: string;

  /**
   * Create a new user context provider
   * 
   * @param userId - The user ID to use for operations. If not provided, uses default.
   * @note Currently accepts userId as parameter. In production, this should be derived
   *       from authentication/session management (e.g., JWT token, session store)
   */
  constructor(userId?: string) {
    // Default to '1' for development/testing if no userId provided
    this.userId = userId || '1';
    
    if (!userId) {
      console.log('UserContextProvider: No userId provided, using default "1"');
    }
  }

  /**
   * Get the current user ID
   * 
   * @returns The user ID for the current context
   */
  getUserId(): string {
    return this.userId;
  }

  /**
   * Update the user ID for this context
   * 
   * @param userId - The new user ID
   */
  setUserId(userId: string): void {
    this.userId = userId;
  }
}
