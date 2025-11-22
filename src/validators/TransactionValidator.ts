import { TransactionType, isValidTransactionType, TRANSACTION_TYPES } from '../config/transactionTypes';

/**
 * Validation result for transactions
 */
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

/**
 * Validator for basic transaction data
 * Separates validation logic from business logic
 */
export class TransactionValidator {
  /**
   * Validate transaction amount
   * 
   * @param amount - The transaction amount to validate
   * @returns Validation result
   */
  static validateAmount(amount: number): ValidationResult {
    const errors: string[] = [];

    if (typeof amount !== 'number' || isNaN(amount)) {
      errors.push('Amount must be a valid number');
    } else if (amount <= 0) {
      errors.push('Amount must be positive');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Validate transaction date
   * 
   * @param date - The transaction date to validate
   * @returns Validation result
   */
  static validateDate(date: Date | string): ValidationResult {
    const errors: string[] = [];

    const dateObj = date instanceof Date ? date : new Date(date);
    
    if (isNaN(dateObj.getTime())) {
      errors.push('Date must be a valid date');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Validate transaction type
   * 
   * @param type - The transaction type to validate
   * @returns Validation result
   */
  static validateType(type: string): ValidationResult {
    const errors: string[] = [];

    if (!isValidTransactionType(type)) {
      errors.push(`Type must be one of: ${TRANSACTION_TYPES.join(', ')}`);
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Normalize date to Date object
   * Defaults to today if not provided
   * 
   * @param date - The date to normalize (Date, string, or undefined)
   * @returns Date object (defaults to today if undefined)
   */
  static normalizeDate(date?: Date | string): string {
    if (!date) {
      console.log('Date not provided, defaulting to today');
      return new Date().toISOString(); // Full ISO-8601: 2025-11-08T17:30:00.000Z
    }
    
    if (date instanceof Date) {
      return date.toISOString(); // Full ISO-8601
    }
    
    // If it's already a string, parse and validate
    const parsedDate = new Date(date);
    if (isNaN(parsedDate.getTime())) {
      // If invalid, default to today
      console.log('Invalid date string provided, defaulting to today');
      return new Date().toISOString();
    }
    
    return parsedDate.toISOString(); // Full ISO-8601
  }

  /**
   * Validate all transaction fields with date normalization
   * 
   * @param amount - The transaction amount
   * @param date - The transaction date (can be Date, string, or undefined - defaults to today)
   * @param type - The transaction type
   * @returns Combined validation result with normalized date
   */
  static validateWithNormalization(
    amount: number, 
    date: Date | string | undefined,
    type: TransactionType
  ): ValidationResult & { normalizedDate: string } {
    const amountResult = TransactionValidator.validateAmount(amount);
    const typeResult = TransactionValidator.validateType(type);
    
    // Normalize date (defaults to today if undefined)
    const normalizedDate = TransactionValidator.normalizeDate(date);
    
    // Validate normalized date
    const dateResult = TransactionValidator.validateDate(normalizedDate);

    return {
      isValid: amountResult.isValid && dateResult.isValid && typeResult.isValid,
      errors: [...amountResult.errors, ...dateResult.errors, ...typeResult.errors],
      normalizedDate,
    };
  }
}
