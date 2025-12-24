import { Transaction as PrismaTransaction, RecurringTransaction as PrismaRecurringTransaction } from '../generated/prisma';
import { CategoryNormalizationResult } from './CategoryNormalizer';
import { RecurrencePattern } from '../domain/RecurrencePattern';
import { TransactionType } from '../config/transactionTypes';
import { TransactionData } from '../types/models';

/**
 * Utility class for building user-facing messages
 * Centralizes all message formatting logic for consistency
 */
export class MessageBuilder {
  /**
   * Format a date for user-friendly display
   * Supports both date-only (YYYY-MM-DD) and date+time (ISO-8601) formats
   * 
   * @param date - Date object or ISO string
   * @returns Formatted string: "MM/DD/YYYY" or "MM/DD/YYYY at H:MM AM/PM"
   */
  private static formatDate(date: Date | string): string {
    let dateObj: Date;
    let hasTime = false;

    if (typeof date === 'string') {
      // Check if the string contains time component (has 'T')
      hasTime = date.includes('T');
      dateObj = new Date(date);
    } else {
      dateObj = date;
      hasTime = true; // Date objects always have time
    }

    // Extract date components
    const month = dateObj.getMonth() + 1; // 0-indexed, so add 1
    const day = dateObj.getDate();
    const year = dateObj.getFullYear();

    // Format date as MM/DD/YYYY
    const formattedDate = `${month}/${day}/${year}`;

    // If no time component, return just the date
    if (!hasTime) {
      return formattedDate;
    }

    // Format time in 12-hour format with AM/PM
    let hours = dateObj.getHours();
    const minutes = dateObj.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    
    // Convert to 12-hour format
    hours = hours % 12;
    hours = hours ? hours : 12; // 0 should be 12
    
    // Pad minutes with leading zero if needed
    const minutesStr = minutes.toString().padStart(2, '0');

    return `${formattedDate} at ${hours}:${minutesStr} ${ampm}`;
  }

  /**
   * Get the transaction type label for messages
   */
  private static getTransactionTypeLabel(type: TransactionType): string {
    return type === TransactionType.EXPENSE ? 'Expense' : 'Income';
  }

  /**
   * Get the transaction verb for messages
   */
  private static getTransactionVerb(type: TransactionType): string {
    return type === TransactionType.EXPENSE ? 'added' : 'recorded';
  }

  /**
   * Build message for transaction creation
   * 
   * @param transaction - The created transaction
   * @param normalizationResult - Category normalization result
   * @returns Formatted success message
   */
  static buildTransactionCreatedMessage(
    transaction: PrismaTransaction,
    normalizationResult: CategoryNormalizationResult
  ): string {
    const label = MessageBuilder.getTransactionTypeLabel(transaction.type as TransactionType);
    const verb = MessageBuilder.getTransactionVerb(transaction.type as TransactionType);

    let message = `${label} ${verb} successfully: $${transaction.amount} in category "${transaction.category}"`;

    if (normalizationResult.wasNormalized) {
      message += ` (categorized from "${normalizationResult.originalCategory}")`;
    }

    if (transaction.description) {
      message += ` - ${transaction.description}`;
    }

    message += ` on ${MessageBuilder.formatDate(transaction.date)}`;

    return message;
  }

  /**
   * Build message for recurring transaction creation
   * 
   * @param recurringTransaction - The created recurring transaction
   * @param recurrencePattern - The recurrence pattern domain object
   * @param normalizationResult - Category normalization result
   * @returns Formatted success message
   */
  static buildRecurringTransactionCreatedMessage(
    recurringTransaction: PrismaRecurringTransaction,
    recurrencePattern: RecurrencePattern,
    normalizationResult: CategoryNormalizationResult
  ): string {
    const label = MessageBuilder.getTransactionTypeLabel(recurringTransaction.type as TransactionType);
    const frequencyDesc = recurrencePattern.getDescription();

    let message = `Recurring ${label.toLowerCase()} created: $${recurringTransaction.amount} for ${recurringTransaction.category}`;

    if (normalizationResult.wasNormalized) {
      message += ` (categorized from "${normalizationResult.originalCategory}")`;
    }

    if (recurringTransaction.description) {
      message += ` - ${recurringTransaction.description}`;
    }

    message += ` ${frequencyDesc}`;

    return message;
  }

  /**
   * Build warning message for category normalization
   * 
   * @param normalizationResult - Category normalization result
   * @returns Warning message or undefined if not normalized
   */
  static buildCategoryNormalizationWarning(
    normalizationResult: CategoryNormalizationResult
  ): string | undefined {
    if (normalizationResult.wasNormalized) {
      return `Category "${normalizationResult.originalCategory}" was normalized to "${normalizationResult.category}"`;
    }
    return undefined;
  }

  /**
   * Build message for transaction update
   * 
   * @param originalTransaction - The original transaction data before update
   * @param updatedTransaction - The updated transaction data
   * @param normalizationResult - Category normalization result
   * @returns Formatted success message
   */
  static buildTransactionUpdatedMessage(
    originalTransaction: TransactionData,
    updatedTransaction: TransactionData,
    normalizationResult: CategoryNormalizationResult
  ): string {
    const label = MessageBuilder.getTransactionTypeLabel(updatedTransaction.type);
    const changes: string[] = [];

    // Detect what changed
    if (originalTransaction.amount !== updatedTransaction.amount) {
      changes.push(`amount from $${originalTransaction.amount} to $${updatedTransaction.amount}`);
    }

    if (originalTransaction.category !== updatedTransaction.category) {
      let categoryChange = `category from "${originalTransaction.category}" to "${updatedTransaction.category}"`;
      if (normalizationResult.wasNormalized) {
        categoryChange += ` (normalized from "${normalizationResult.originalCategory}")`;
      }
      changes.push(categoryChange);
    }

    if (originalTransaction.description !== updatedTransaction.description) {
      if (originalTransaction.description && updatedTransaction.description) {
        changes.push(`description from "${originalTransaction.description}" to "${updatedTransaction.description}"`);
      } else if (updatedTransaction.description) {
        changes.push(`added description "${updatedTransaction.description}"`);
      } else {
        changes.push(`removed description`);
      }
    }

    if (originalTransaction.date !== updatedTransaction.date) {
      changes.push(`date from ${originalTransaction.date} to ${updatedTransaction.date}`);
    }

    if (originalTransaction.type !== updatedTransaction.type) {
      changes.push(`type from ${originalTransaction.type} to ${updatedTransaction.type}`);
    }

    // Build final message
    if (changes.length === 0) {
      return `${label} updated successfully (no changes detected)`;
    }

    let message = `${label} updated successfully: `;
    
    if (changes.length === 1) {
      message += `Changed ${changes[0]}`;
    } else {
      message += `Changed ${changes.slice(0, -1).join(', ')} and ${changes[changes.length - 1]}`;
    }

    // Add current state summary
    message += `. Current: $${updatedTransaction.amount} for ${updatedTransaction.category}`;
    
    if (updatedTransaction.description) {
      message += ` - ${updatedTransaction.description}`;
    }
    
    message += ` on ${updatedTransaction.date}`;

    return message;
  }
}
