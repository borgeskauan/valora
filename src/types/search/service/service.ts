import { ServiceResult } from "../../ServiceResult";
import { TransactionSearchRequest, RecurringTransactionSearchRequest } from "./request";
import { TransactionSearchResponse, RecurringTransactionSearchResponse } from "./response";

export interface ITransactionSearchService {
  /**
   * Method 1:
   * Queries the raw transactions table and returns plain transaction records.
   *
   * Example use:
   * - "How much did I spend in subscriptions up to now?"
   */
  searchTransactions(
    userId: string,
    request: TransactionSearchRequest
  ): Promise<ServiceResult<TransactionSearchResponse>>;

  /**
   * Method 2:
   * Queries the recurring transactions table and returns recurring-transaction
   * definitions (subscriptions). Optionally includes associated raw transactions.
   *
   * Example uses:
   * - "Show me all my subscriptions."
   * - "How much did I spend in my Netflix subscription up to now?"
   */
  searchRecurringTransactions(
    userId: string,
    request: RecurringTransactionSearchRequest
  ): Promise<ServiceResult<RecurringTransactionSearchResponse>>;
}