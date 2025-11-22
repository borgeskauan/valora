import { failure, ServiceResult } from '../types/serviceResult';

/**
 * Shared utility for consistent error handling across services
 * Provides standardized error responses and logging
 */
export class ErrorHandler {
  /**
   * Handle database errors with consistent error response
   * 
   * @param error - The error object
   * @param operation - Description of the operation that failed (e.g., "fetching transaction", "updating record")
   * @returns ServiceResult failure with DATABASE_ERROR code
   */
  static handleDatabaseError<T>(error: unknown, operation: string): ServiceResult<T> {
    console.error(`Database error while ${operation}:`, error);
    return failure(
      `A technical error occurred while ${operation}`,
      'DATABASE_ERROR',
      error instanceof Error ? error.message : 'Unknown error'
    );
  }
}
