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
   * If the category is invalid, finds the closest match
   * 
   * @param category - The category to validate/normalize
   * @param type - The transaction type (expense or income)
   * @returns Normalization result with the final category and metadata
   */
  static normalize(category: string, type: TransactionType): CategoryNormalizationResult {
    if (CategoryNormalizer.isValid(category, type)) {
      return {
        category,
        wasNormalized: false,
      };
    }

    const closestCategory = CategoryNormalizer.findClosestCategory(category, type);
    console.log(`Category "${category}" not found for ${type}. Using closest match: "${closestCategory}"`);
    
    return {
      category: closestCategory,
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
  private static isValid(category: string, type: TransactionType): boolean {
    if (type === TransactionType.EXPENSE) {
      return isValidExpenseCategory(category);
    } else {
      return isValidIncomeCategory(category);
    }
  }

  /**
   * Find the closest category match for the given transaction type
   * Currently returns 'Other' for both types (can be enhanced with fuzzy matching)
   * 
   * @param input - The input category string
   * @param type - The transaction type (expense or income)
   * @returns The closest matching category
   */
  private static findClosestCategory(input: string, type: TransactionType): string {
    return 'Other';
  }
}
