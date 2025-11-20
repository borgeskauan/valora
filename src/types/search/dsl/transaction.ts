import { TransactionType } from "../../../config/transactionTypes";
import { DateRange, AmountRange } from "./core";

export type TransactionKind = "oneTime" | "recurring";
export type RecurringFrequency = "daily" | "weekly" | "monthly" | "yearly";

export interface RecurringFilters {
  frequencies?: RecurringFrequency[];
  intervals?: number[];        // e.g. [1, 2] for every month / every 2 months
  daysOfWeek?: number[];       // 0–6
  daysOfMonth?: number[];      // 1–31
  monthsOfYear?: number[];     // 0–11
  startDateRange?: DateRange;
  nextDueRange?: DateRange;
}

export interface TransactionSearchFilters {
  ids?: string[];
  categories?: string[];
  types?: TransactionType[];   // expense / income

  dateRange?: DateRange;
  amountRange?: AmountRange;

  /**
   * Which "kinds" of transactions to include.
   * - undefined or [] → treat as ["oneTime", "recurring"]
   * - ["oneTime"]     → only one-off
   * - ["recurring"]   → only recurring
   */
  kinds?: TransactionKind[];

  /**
   * Description-based search.
   */
  text?: string;
}

/**
 * Only used by the recurring-search method.
 */
export interface TransactionSearchFiltersRecurring extends TransactionSearchFilters {
  recurring?: RecurringFilters;
}