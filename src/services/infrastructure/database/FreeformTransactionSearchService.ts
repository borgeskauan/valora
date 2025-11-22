import { Collection, FindOptions } from "mongodb";
import {
  TransactionDoc,
  RecurringTransactionDoc,
} from "./schemas";

import { MongoConnectionManager } from "./MongoConnectionManager";
import { failure, ServiceResult, success } from "../../../types/serviceResult";

export type MqlFilter = Record<string, any>;
export type MqlSort = Record<string, 1 | -1>;

export interface MqlFindRequest {
  filter?: MqlFilter;
  sort?: MqlSort;
  limit?: number;
  offset?: number;
}

export interface MqlFindResponse<TDoc> {
  documents: TDoc[];
  total: number;
}

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 500;

export class FreeformTransactionSearchService {
  constructor(
    private readonly transactions: Collection<TransactionDoc>,
    private readonly recurringTransactions: Collection<RecurringTransactionDoc>
  ) {}

  /**
   * Query the Transaction collection with a simple .find(...) style query.
   */
  async searchTransactions(
    userId: string,
    request: MqlFindRequest
  ): Promise<ServiceResult<MqlFindResponse<TransactionDoc>>> {
    try {
      const { filter = {}, sort, limit, offset } = request;

      // Enforce userId server-side, overriding any userId in filter.
      const finalFilter: MqlFilter = {
        ...filter,
        userId,
      };

      const effectiveLimit =
        typeof limit === "number"
          ? Math.min(Math.max(limit, 1), MAX_LIMIT)
          : DEFAULT_LIMIT;

      const effectiveOffset =
        typeof offset === "number" ? Math.max(offset, 0) : 0;

      const findOptions: FindOptions = {
        sort,
        limit: effectiveLimit,
        skip: effectiveOffset,
        // projection: undefined, // full docs for now
      };

      const cursor = this.transactions.find(finalFilter, findOptions);
      const documents = await cursor.toArray();
      const total = await this.transactions.countDocuments(finalFilter);

      return success<MqlFindResponse<TransactionDoc>>(
        { documents, total },
        "Transactions query executed successfully"
      );
    } catch (err) {
      const details =
        err instanceof Error ? err.message : "Unknown error querying transactions";

      return failure<MqlFindResponse<TransactionDoc>>(
        "Failed to query transactions",
        "DB_QUERY_ERROR",
        details
      );
    }
  }

  /**
   * Query the RecurringTransaction collection with a simple .find(...) query.
   */
  async searchRecurringTransactions(
    userId: string,
    request: MqlFindRequest
  ): Promise<ServiceResult<MqlFindResponse<RecurringTransactionDoc>>> {
    try {
      const { filter = {}, sort, limit, offset } = request;

      const finalFilter: MqlFilter = {
        ...filter,
        userId,
      };

      const effectiveLimit =
        typeof limit === "number"
          ? Math.min(Math.max(limit, 1), MAX_LIMIT)
          : DEFAULT_LIMIT;

      const effectiveOffset =
        typeof offset === "number" ? Math.max(offset, 0) : 0;

      const findOptions: FindOptions = {
        sort,
        limit: effectiveLimit,
        skip: effectiveOffset,
      };

      const cursor =
        this.recurringTransactions.find(finalFilter, findOptions);
      const documents = await cursor.toArray();
      const total =
        await this.recurringTransactions.countDocuments(finalFilter);

      return success<MqlFindResponse<RecurringTransactionDoc>>(
        { documents, total },
        "Recurring transactions query executed successfully"
      );
    } catch (err) {
      const details =
        err instanceof Error
          ? err.message
          : "Unknown error querying recurring transactions";

      return failure<MqlFindResponse<RecurringTransactionDoc>>(
        "Failed to query recurring transactions",
        "DB_QUERY_ERROR",
        details
      );
    }
  }
}

export async function createTransactionQueryService(): Promise<FreeformTransactionSearchService> {
  const manager = MongoConnectionManager.fromEnv();

  const [transactions, recurringTransactions] = await Promise.all([
    manager.getTransactionCollection(),
    manager.getRecurringTransactionCollection(),
  ]);

  return new FreeformTransactionSearchService(transactions, recurringTransactions);
}
