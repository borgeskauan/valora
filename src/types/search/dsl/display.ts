import { AggregationRow } from "./aggregations";
import { RecurringFrequency } from "./transaction";

export interface TransactionSearchHitDisplay {
  id: string;

  isRecurring: boolean; // raw layer decides this

  display: {
    formattedDate: string;    // e.g. "10/11/2025"
    formattedAmount: string;  // e.g. "R$ 120,50"
    category: string;
    description?: string | null;
    typeLabel: string;        // "Expense" / "Income"
  };
}

export interface RecurringTransactionDisplayData {
  id: string;
  frequency: RecurringFrequency;
  interval: number;
  nextDueFormatted?: string;
  startDateFormatted?: string;
  // add more pretty fields if needed
}

/**
 * Hit returned by the recurring-search method.
 */
export interface RecurringTransactionSearchHitDisplay
  extends TransactionSearchHitDisplay {
  /**
   * Recurring metadata (definition).
   */
  recurring: RecurringTransactionDisplayData;

  /**
   * Only present when includeRawTransactions = true.
   * All raw transactions associated with this recurring definition.
   */
  rawTransactions?: TransactionSearchHitDisplay[];

  /**
   * Optional aggregates over those raw transactions (per subscription).
   * Example: sum of all Netflix charges up to now.
   */
  rawTransactionsAggregates?: AggregationRow[];
}