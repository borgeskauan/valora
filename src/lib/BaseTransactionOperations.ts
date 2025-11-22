import { PrismaClient } from '../generated/prisma';
import { CategoryNormalizer, CategoryNormalizationResult } from './CategoryNormalizer';
import { UserContextProvider } from './UserContextProvider';
import { MessageBuilder } from './MessageBuilder';
import { PrismaClientManager } from './PrismaClientManager';
import { ServiceResult } from '../types/serviceResult';
import { TransactionValidator } from '../validators/TransactionValidator';
import { TransactionType } from '../config/transactionTypes';
import { ErrorHandler } from './ErrorHandler';

/**
 * Result of basic transaction data validation
 */
export interface BasicTransactionValidationResult {
  isValid: boolean;
  amount: number;
  normalizedCategory: string;
  normalizedDate: string; // ISO-8601 DateTime string (e.g., 2025-11-08T17:30:00.000Z)
  warnings: string[];
  validationErrors?: string[];
}

/**
 * Base utility class providing shared operations for transaction services
 * Follows composition pattern - services compose with this utility
 */
export class BaseTransactionOperations {
  protected prisma: PrismaClient;
  protected categoryNormalizer: CategoryNormalizer;
  protected userContext: UserContextProvider;
  protected messageBuilder: MessageBuilder;
  protected transactionValidator: TransactionValidator;

  constructor(userContext?: UserContextProvider) {
    this.prisma = PrismaClientManager.getClient();
    this.categoryNormalizer = new CategoryNormalizer();

    // TODO: Remove this from here, keep it in the services. This means removing the injectUserId method too.
    this.userContext = userContext || new UserContextProvider();
    this.messageBuilder = new MessageBuilder();
    this.transactionValidator = new TransactionValidator();
  }

  /**
   * Validate basic transaction data (amount, date, category, type)
   * This is the shared validation pipeline for both TransactionService and RecurringTransactionService
   * 
   * @param amount - The transaction amount
   * @param category - The transaction category
   * @param type - The transaction type (expense or income)
   * @param date - The transaction date (optional, defaults to today)
   * @returns Validation result with normalized data and warnings
   */
  validateBasicTransactionData(
    amount: number,
    category: string,
    type: TransactionType,
    date?: Date | string
  ): BasicTransactionValidationResult {
    // Validate amount, type, and normalize date
    const validationResult = this.transactionValidator.validateWithNormalization(amount, date, type);
    
    if (!validationResult.isValid) {
      return {
        isValid: false,
        amount,
        normalizedCategory: category,
        normalizedDate: validationResult.normalizedDate,
        warnings: [],
        validationErrors: validationResult.errors,
      };
    }

    // Normalize category based on transaction type
    const normalizationResult = this.categoryNormalizer.normalize(category, type);
    
    // Build category warnings
    const warnings = this.buildCategoryWarnings(normalizationResult);

    return {
      isValid: true,
      amount,
      normalizedCategory: normalizationResult.category,
      normalizedDate: validationResult.normalizedDate,
      warnings,
    };
  }

  /**
   * Build category normalization warnings from normalization result
   * 
   * @param normalizationResult - The result from category normalization
   * @returns Array of warning strings (empty if no warnings)
   */
  private buildCategoryWarnings(normalizationResult: CategoryNormalizationResult): string[] {
    const warnings: string[] = [];
    const categoryWarning = this.messageBuilder.buildCategoryNormalizationWarning(normalizationResult);
    if (categoryWarning) {
      warnings.push(categoryWarning);
    }
    return warnings;
  }

  /**
   * Build basic update data by validating and merging updates with existing data
   * Shared logic for both TransactionService and RecurringTransactionService updates
   * 
   * @param updates - Partial update data containing fields to change
   * @param existingData - Existing transaction data
   * @param dateField - The date field to use from existing data (e.g., 'date' or 'startDate')
   * @returns Object with validation results, update data, and warnings
   */
  buildBasicUpdateData<TUpdates extends { amount?: number; category?: string; description?: string | null; type?: TransactionType }>(
    updates: TUpdates,
    existingData: { amount: number; category: string; type: string; [key: string]: any },
    dateField: string = 'date'
  ): {
    isValid: boolean;
    updateData?: any;
    warnings: string[];
    validationErrors?: string[];
    originalCategory?: string;
  } {
    const originalCategory = updates.category;
    const finalType = (updates.type || existingData.type) as TransactionType;

    // Merge updates with existing data for validation
    const mergedData = {
      amount: updates.amount !== undefined ? updates.amount : existingData.amount,
      category: updates.category !== undefined ? updates.category : existingData.category,
      type: finalType,
    };

    // Validate all basic fields at once
    const validationResult = this.validateBasicTransactionData(
      mergedData.amount,
      mergedData.category,
      mergedData.type,
      existingData[dateField]
    );

    if (!validationResult.isValid) {
      return {
        isValid: false,
        warnings: [],
        validationErrors: validationResult.validationErrors,
      };
    }

    // Build update data only with fields that were actually provided
    const updateData: any = {};

    if (updates.amount !== undefined) {
      updateData.amount = validationResult.amount;
    }

    if (updates.category !== undefined) {
      updateData.category = validationResult.normalizedCategory;
    }

    if (updates.description !== undefined) {
      updateData.description = updates.description || null;
    }

    if (updates.type !== undefined && updates.type !== existingData.type) {
      updateData.type = updates.type;
      // When type changes, category must be re-validated and normalized for the new type
      updateData.category = validationResult.normalizedCategory;
    }

    return {
      isValid: true,
      updateData,
      warnings: validationResult.warnings,
      originalCategory,
    };
  }

  /**
   * Get the current user ID from context
   * Simpler alternative to injectUserId for read operations
   * 
   * @returns The current user ID
   */
  getUserId(): string {
    return this.userContext.getUserId();
  }

  /**
   * Inject current user ID into data object
   * Mutates the data object
   * Use this for write operations where userId needs to be persisted
   * 
   * @param data - The data object to inject userId into
   */
  injectUserId<T extends { userId?: string }>(data: T): void {
    data.userId = this.userContext.getUserId();
  }

  /**
   * Handle database errors with consistent error response
   * Delegates to shared ErrorHandler utility
   * 
   * @param error - The error object
   * @param operation - Description of the operation that failed
   * @returns ServiceResult failure with DATABASE_ERROR code
   */
  handleDatabaseError<T>(error: unknown, operation: string): ServiceResult<T> {
    return ErrorHandler.handleDatabaseError(error, operation);
  }
}
