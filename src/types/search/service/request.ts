import { AggregationRequest } from "../dsl/aggregations";
import { SortField, SortDirection } from "../dsl/core";
import { PresentationOptions } from "../dsl/presentation";
import { TransactionSearchFilters, TransactionSearchFiltersRecurring } from "../dsl/transaction";

export interface TransactionSearchRequestBase<
  F extends TransactionSearchFilters = TransactionSearchFilters
> {
  filters?: F;
  aggregation?: AggregationRequest;

  // pagination
  limit?: number;   // default e.g. 50
  offset?: number;  // default 0

  // sorting
  sort?: {
    field: SortField;
    direction: SortDirection;
  }[];

  // presentation preferences
  presentation?: PresentationOptions;
}

/**
 * Method 1 – queries the raw transactions table and returns plain transaction records.
 */
export type TransactionSearchRequest =
  TransactionSearchRequestBase<TransactionSearchFilters>;

/**
 * Method 2 – queries the recurring transactions table and returns
 * recurring-transaction definitions (subscriptions).
 *
 * Can optionally include associated raw transactions for each definition.
 */
export interface RecurringTransactionSearchRequest
  extends TransactionSearchRequestBase<TransactionSearchFiltersRecurring> {
  /**
   * If true, also fetch raw transactions associated with each
   * recurring definition (e.g. all Netflix charges).
   */
  includeRawTransactions?: boolean;

  /**
   * Optional: how to aggregate the associated raw transactions
   * per recurring definition.
   *
   * Example: sum of all Netflix charges up to now.
   */
  rawTransactionsAggregation?: AggregationRequest;
}