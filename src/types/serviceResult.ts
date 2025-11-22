/**
 * Generic service result type for standardized responses
 * 
 * @template T - The type of data returned on success
 */
export interface ServiceResult<T> {
  /**
   * Whether the operation was successful
   */
  success: boolean;

  /**
   * Human-readable message describing the result
   */
  message: string;

  /**
   * The data returned by the operation (only present on success)
   */
  data?: T;

  /**
   * Optional warnings that don't prevent success but should be communicated
   * Example: "Category was normalized from 'food' to 'Food & Dining'"
   */
  warnings?: string[];

  /**
   * Error details (only present on failure)
   */
  error?: {
    code?: string;
    details?: string;
    validationErrors?: string[];
  };
}

/**
 * Helper function to create a successful result
 * 
 * @param data - The data to return
 * @param message - Success message
 * @param warnings - Optional warnings
 * @returns ServiceResult with success=true
 */
export function success<T>(
  data: T,
  message: string,
  warnings?: string[]
): ServiceResult<T> {
  return {
    success: true,
    message,
    data,
    ...(warnings && warnings.length > 0 && { warnings }),
  };
}

/**
 * Helper function to create a failure result
 * 
 * @param message - Error message
 * @param code - Optional error code
 * @param details - Optional error details
 * @param validationErrors - Optional array of specific validation errors
 * @returns ServiceResult with success=false
 */
export function failure<T = never>(
  message: string,
  code?: string,
  details?: string,
  validationErrors?: string[]
): ServiceResult<T> {
  return {
    success: false,
    message,
    error: {
      ...(code && { code }),
      ...(details && { details }),
      ...(validationErrors && validationErrors.length > 0 && { validationErrors }),
    },
  };
}
