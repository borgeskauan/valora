import { isValidExpenseCategory } from '../config/expenseCategories';
import { isValidIncomeCategory } from '../config/incomeCategories';
import { TransactionType } from '../config/transactionTypes';

/**
 * Result of category normalization
 */
export interface CategoryNormalizationResult {
  category: string;
  wasNormalized: boolean;
  originalCategory?: string;
}

/**
 * Utility class for validating and normalizing transaction categories
 * Uses composition to share category validation logic across services
 * Handles both expense and income categories based on transaction type
 */
export class CategoryNormalizer {
  /**
   * Validate and normalize a category string based on transaction type
   * If the category is invalid, defaults to 'Other'
   * 
   * @param category - The category to validate/normalize
   * @param type - The transaction type (expense or income)
   * @returns Normalization result with the final category and metadata
   */
  normalize(category: string, type: TransactionType): CategoryNormalizationResult {
    if (this.isValid(category, type)) {
      return {
        category,
        wasNormalized: false,
      };
    }

    // Invalid category - normalize to 'Other'
    console.log(`Category "${category}" not found for ${type}. Using "Other".`);
    
    return {
      category: 'Other',
      wasNormalized: true,
      originalCategory: category,
    };
  }

  /**
   * Check if a category is valid for the given transaction type
   * 
   * @param category - The category to validate
   * @param type - The transaction type (expense or income)
   * @returns true if valid, false otherwise
   */
  private isValid(category: string, type: TransactionType): boolean {
    if (type === TransactionType.EXPENSE) {
      return isValidExpenseCategory(category);
    } else {
      return isValidIncomeCategory(category);
    }
  }
}
