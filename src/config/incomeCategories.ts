/**
 * Default income categories
 * These are the standard categories available for income transactions
 */
export const INCOME_CATEGORY_DEFS = [
  {
    id: 'Salary',
    description:
      'Regular employment income such as wages, payroll deposits, paychecks, and other compensation from an employer.',
  },
  {
    id: 'Business Income',
    description:
      'Income from running or owning a business, including owner draws, distributions, and operating revenue you treat as personal inflow.',
  },
  {
    id: 'Freelance',
    description:
      'Income from contract work, gigs, consulting, and other self-employed services billed per project or per hour.',
  },
  {
    id: 'Bonuses',
    description:
      'Extra compensation such as performance bonuses, commissions, tips, incentives, or one-time workplace payouts.',
  },
  {
    id: 'Investment Returns',
    description:
      'Returns from investments such as dividends, interest, capital gains distributions, bond coupons, and similar portfolio income.',
  },
  {
    id: 'Rental Income',
    description:
      'Rent received from properties or rooms, including long-term rentals and short-term stays when treated as rental inflow.',
  },
  {
    id: 'Refunds',
    description:
      'Refunds and reimbursements such as returned purchases, chargebacks, employer reimbursements, or rebates credited back to you.',
  },
  {
    id: 'Gifts Received',
    description:
      'Money received as gifts from friends or family (cash, transfers, or gift payments).',
  },
  {
    id: 'Loans Received',
    description:
      'Borrowed money such as personal loans, payday advances, credit line draws, or money lent to you that you plan to repay.',
  },
  {
    id: 'Other',
    description:
      'Income that does not clearly fit into any other category or is one-off / unusual.',
  },
] as const;


export type IncomeCategory = (typeof INCOME_CATEGORY_DEFS)[number]["id"];

export const INCOME_CATEGORIES = INCOME_CATEGORY_DEFS.map((c) => c.id);

export function isValidIncomeCategory(category: string): category is IncomeCategory {
  return INCOME_CATEGORY_DEFS.some((c) => c.id === category);
}

export function getIncomeCategoryDescription(): string {
  return `Available income categories: ${INCOME_CATEGORIES.join(
    ", "
  )}. Choose the most appropriate category based on the income source.`;
}