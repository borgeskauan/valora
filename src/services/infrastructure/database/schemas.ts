/**
 * Matches Prisma model Transaction (Mongo collection "Transaction" by default).
 */
export interface TransactionDoc {
  _id: string;                 // Prisma id @map("_id")

  userId: string;
  date: string;                // ISO-8601 DateTime string
  amount: number;              // always positive; type indicates direction
  category: string;
  description?: string | null;
  type: string;                // "expense" | "income"

  recurringTransactionId?: string | null;

  createdAt: Date;
  updatedAt: Date;

  [key: string]: unknown;
}

/**
 * Matches Prisma model RecurringTransaction (collection "RecurringTransaction").
 */
export interface RecurringTransactionDoc {
  _id: string;

  userId: string;
  amount: number;
  category: string;
  description?: string | null;
  type: string;                // "expense" | "income"

  frequency: string;           // "daily" | "weekly" | "monthly" | "yearly"
  interval: number;
  dayOfWeek?: number | null;   // 0–6
  dayOfMonth?: number | null;  // 1–31
  monthOfYear?: number | null; // 0–11

  startDate: string;           // ISO-8601 string
  nextDue: string;             // ISO-8601 string

  isActive: boolean;

  createdAt: Date;
  updatedAt: Date;

  [key: string]: unknown;
}
