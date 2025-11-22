/**
 * Default expense categories
 * These are the standard categories available for expense transactions
 */
export const EXPENSE_CATEGORIES = [
  // Essentials
  'Housing',
  'Groceries',
  'Transportation',
  'Bills',
  'Insurance',
  'Taxes & Fees',
  'Health',

  // Financial
  'Savings & Investments',

  // Food & Leisure
  'Food & Dining',
  'Entertainment',
  'Streaming',
  'Subscriptions',
  'Travel',

  // Personal & Lifestyle
  'Fitness',
  'Personal Care',
  'Shopping',
  'Pets',
  'Education',
  'Gifts & Donations',

  // Fallback
  'Other'
] as const;


/**
 * Category type derived from the expense categories
 */
export type ExpenseCategory = typeof EXPENSE_CATEGORIES[number];

/**
 * Check if a category is valid expense category
 */
export function isValidExpenseCategory(category: string): boolean {
  return EXPENSE_CATEGORIES.includes(category as ExpenseCategory);
}
