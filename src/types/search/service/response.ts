import { AggregationRow } from "../dsl/aggregations";
import { TransactionSearchHitDisplay, RecurringTransactionSearchHitDisplay } from "../dsl/display";

export interface TransactionSearchResponseBase<T> {
  hits: T[];
  total: number;

  aggregates?: AggregationRow[];
}

/**
 * Response for raw transactions.
 */
export type TransactionSearchResponse =
  TransactionSearchResponseBase<TransactionSearchHitDisplay>;

/**
 * Response for recurring transactions.
 */
export type RecurringTransactionSearchResponse =
  TransactionSearchResponseBase<RecurringTransactionSearchHitDisplay>;