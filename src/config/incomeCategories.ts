/**
 * Default income categories
 * These are the standard categories available for income transactions
 */
export const INCOME_CATEGORIES = [
  // Active income
  'Salary',
  'Business Income',
  'Freelance',
  'Bonuses',

  // Passive & portfolio income
  'Investment Returns',
  'Rental Income',

  // Irregular / non-operating inflows
  'Refunds',
  'Gifts Received',
  'Loans Received',

  // Fallback
  'Other'
] as const;

/**
 * Income category type derived from the default income categories
 */
export type IncomeCategory = typeof INCOME_CATEGORIES[number];

/**
 * Check if a category is valid income category
 */
export function isValidIncomeCategory(category: string): boolean {
  return INCOME_CATEGORIES.includes(category as IncomeCategory);
}
