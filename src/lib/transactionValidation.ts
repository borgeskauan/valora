/**
 * Pure utility functions for transaction validation and data building
 * These functions have no side effects and are easy to test
 */

import { TransactionType } from '../config/transactionTypes';
import { ServiceResult, failure } from '../types/serviceResult';
import { TransactionValidator } from '../validators/TransactionValidator';
import { CategoryNormalizer, CategoryNormalizationResult } from './CategoryNormalizer';
import { MessageBuilder } from './MessageBuilder';

/**
 * Result type for basic transaction validation
 */
export interface BasicTransactionValidationResult {
  isValid: boolean;
  amount: number;
  normalizedCategory: string;
  normalizedDate: string;
  warnings: string[];
  validationErrors?: string[];
}

/**
 * Result type for update data building
 */
export interface UpdateDataResult {
  isValid: boolean;
  updateData?: any;
  warnings: string[];
  validationErrors?: string[];
  originalCategory?: string;
}

/**
 * Validate basic transaction data (amount, date, category, type)
 * This is the shared validation pipeline for both TransactionService and RecurringTransactionService
 * 
 * @param amount - The transaction amount
 * @param category - The transaction category
 * @param type - The transaction type (expense or income)
 * @param date - The transaction date (optional, defaults to today)
 * @param validator - TransactionValidator instance
 * @param normalizer - CategoryNormalizer instance
 * @param messageBuilder - MessageBuilder instance
 * @returns Validation result with normalized data and warnings
 */
export function validateBasicTransactionData(
  amount: number,
  category: string,
  type: TransactionType,
  date: Date | string | undefined,
  validator: TransactionValidator,
  normalizer: CategoryNormalizer,
  messageBuilder: MessageBuilder
): BasicTransactionValidationResult {
  // Validate amount, type, and normalize date
  const validationResult = validator.validateWithNormalization(amount, date, type);
  
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
  const normalizationResult = normalizer.normalize(category, type);
  
  // Build category warnings
  const warnings = buildCategoryWarnings(normalizationResult, messageBuilder);

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
 * @param messageBuilder - MessageBuilder instance
 * @returns Array of warning strings (empty if no warnings)
 */
function buildCategoryWarnings(
  normalizationResult: CategoryNormalizationResult,
  messageBuilder: MessageBuilder
): string[] {
  const warnings: string[] = [];
  const categoryWarning = messageBuilder.buildCategoryNormalizationWarning(normalizationResult);
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
 * @param validator - TransactionValidator instance
 * @param normalizer - CategoryNormalizer instance
 * @param messageBuilder - MessageBuilder instance
 * @returns Object with validation results, update data, and warnings
 */
export function buildBasicUpdateData<TUpdates extends { 
  amount?: number; 
  category?: string; 
  description?: string | null; 
  type?: TransactionType 
}>(
  updates: TUpdates,
  existingData: { amount: number; category: string; type: string; [key: string]: any },
  dateField: string,
  validator: TransactionValidator,
  normalizer: CategoryNormalizer,
  messageBuilder: MessageBuilder
): UpdateDataResult {
  const originalCategory = updates.category;
  const finalType = (updates.type || existingData.type) as TransactionType;

  // Merge updates with existing data for validation
  const mergedData = {
    amount: updates.amount !== undefined ? updates.amount : existingData.amount,
    category: updates.category !== undefined ? updates.category : existingData.category,
    type: finalType,
  };

  // Validate all basic fields at once
  const validationResult = validateBasicTransactionData(
    mergedData.amount,
    mergedData.category,
    mergedData.type,
    existingData[dateField],
    validator,
    normalizer,
    messageBuilder
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
 * Handle database errors with consistent error response
 * 
 * @param error - The error object
 * @param operation - Description of the operation that failed
 * @returns ServiceResult failure with DATABASE_ERROR code
 */
export function handleDatabaseError<T>(error: unknown, operation: string): ServiceResult<T> {
  console.error(`Database error in ${operation}:`, error);
  return failure(
    `A technical error occurred while ${operation}`,
    'DATABASE_ERROR',
    error instanceof Error ? error.message : 'Unknown error'
  );
}
