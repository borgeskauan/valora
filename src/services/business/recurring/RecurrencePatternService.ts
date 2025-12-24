import { RecurringTransactionValidator } from '../../../validators/RecurringTransactionValidator';
import { RecurrencePattern } from '../../../domain/RecurrencePattern';
import { TransactionType } from '../../../config/transactionTypes';

/**
 * Service for validating and calculating recurrence patterns
 * Pure business logic with no side effects
 */
export class RecurrencePatternService {
  /**
   * Validate and create recurrence pattern with next due date calculation
   * 
   * @param amount - Transaction amount (required for validation context)
   * @param frequency - Recurrence frequency (daily, weekly, monthly, yearly)
   * @param type - Transaction type (expense or income)
   * @param interval - Optional interval multiplier
   * @param dayOfWeek - Required for weekly (0-6, Sunday-Saturday)
   * @param dayOfMonth - Required for monthly (1-31)
   * @param monthOfYear - Required for yearly (0-11, January-December)
   * @returns Validation result with recurrence pattern and next due date
   */
  validate(
    amount: number,
    frequency: string,
    type: TransactionType,
    interval?: number | null,
    dayOfWeek?: number | null,
    dayOfMonth?: number | null,
    monthOfYear?: number | null
  ): { isValid: boolean; recurrencePattern?: RecurrencePattern; nextDue?: string; errors?: string[] } {
    // Validate the recurrence pattern using existing validator
    const recurrenceValidation = RecurringTransactionValidator.validate(
      amount,
      frequency as any,
      type,
      interval,
      dayOfWeek,
      dayOfMonth,
      monthOfYear
    );

    if (!recurrenceValidation.isValid || !recurrenceValidation.recurrencePattern) {
      return {
        isValid: false,
        errors: recurrenceValidation.errors,
      };
    }

    const recurrencePattern = recurrenceValidation.recurrencePattern;
    const nextDue = this.calculateNextDue(recurrencePattern);

    return {
      isValid: true,
      recurrencePattern,
      nextDue,
    };
  }

  /**
   * Calculate the next due date for a recurrence pattern
   * 
   * @param pattern - RecurrencePattern domain object
   * @returns ISO string representation of next due date
   */
  calculateNextDue(pattern: RecurrencePattern): string {
    return pattern.calculateNextDueDate();
  }
}
