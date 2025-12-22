export const EXPENSE_CATEGORY_DEFS = [
  {
    id: 'Housing',
    description:
      'Rent, mortgage payments, property taxes, HOA fees, home repairs, and other housing-related costs.',
  },
  {
    id: 'Groceries',
    description:
      'Food and household essentials bought at supermarkets, grocery stores, markets, bakeries, and similar places.',
  },
  {
    id: 'Transportation',
    description:
      'Public transport, rideshare (Uber, Lyft), taxis, fuel, parking, tolls, car maintenance, and similar travel costs.',
  },
  {
    id: 'Bills',
    description:
      'Recurring utility and service bills such as electricity, water, gas, internet, mobile phone, and streaming or digital service subscriptions treated as utilities.',
  },
  {
    id: 'Insurance',
    description:
      'Health, auto, home, renter, life, and other insurance premiums.',
  },
  {
    id: 'Taxes & Fees',
    description:
      'Income taxes, property taxes, government fees, bank fees, service charges, late fees, and fines.',
  },
  {
    id: 'Health',
    description:
      'Doctor and dentist visits, pharmacy purchases, medications, medical tests, therapy, and medical equipment.',
  },
  {
    id: 'Savings & Investments',
    description:
      'Transfers to savings accounts, investment accounts, retirement funds, brokerage, crypto, or other long-term wealth-building.',
  },
  {
    id: 'Food & Dining',
    description:
      'Restaurants, cafes, bars, fast food, takeout, and food delivery orders.',
  },
  {
    id: 'Entertainment',
    description:
      'Movies, concerts, events, games, hobbies, recreational activities, and non-essential media or fun spending.',
  },
  {
    id: 'Travel',
    description:
      'Flights, trains, buses, hotels, vacation rentals, travel packages, and other trip or vacation expenses.',
  },
  {
    id: 'Fitness',
    description:
      'Gym memberships, sports clubs, fitness classes, sports activities, and exercise-related services.',
  },
  {
    id: 'Personal Care',
    description:
      'Haircuts, grooming, cosmetics, beauty treatments, toiletries, and other personal care products or services.',
  },
  {
    id: 'Shopping',
    description:
      'Clothing, electronics, furniture, home goods, and other non-grocery retail purchases.',
  },
  {
    id: 'Pets',
    description:
      'Pet food, vet visits, pet insurance, grooming, toys, and other pet-related expenses.',
  },
  {
    id: 'Education',
    description:
      'Tuition, courses, books, learning apps, certifications, training, and conferences.',
  },
  {
    id: 'Gifts & Donations',
    description:
      'Gifts for others, charitable donations, tithes, and other contributions or support payments.',
  },
  {
    id: 'Other',
    description:
      'Expenses that do not clearly fit into any other category or are one-off / unusual.',
  },
] as const;

export type ExpenseCategory = (typeof EXPENSE_CATEGORY_DEFS)[number]["id"];

export const EXPENSE_CATEGORIES = EXPENSE_CATEGORY_DEFS.map((c) => c.id);

export function isValidExpenseCategory(category: string): category is ExpenseCategory {
  return EXPENSE_CATEGORY_DEFS.some((c) => c.id === category);
}

export function getExpenseCategoryDescription(): string {
  return `Available expense categories: ${EXPENSE_CATEGORIES.join(
    ", "
  )}. Choose the most appropriate category based on the expense type.`;
}