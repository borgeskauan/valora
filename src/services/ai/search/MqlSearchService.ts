import { Collection, FindOptions } from "mongodb";
import {
  TransactionDoc,
  RecurringTransactionDoc,
} from "./schemas";

import { MongoClientManager } from "./MongoClientManager";
import { failure, ServiceResult, success } from "../../../types/ServiceResult";

export type MqlFilter = Record<string, any>;
export type MqlSort = Record<string, 1 | -1>;

export interface MqlFindRequest {
  userId: string;
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

export class MqlSearchService {
  constructor(
    private readonly transactions: Collection<TransactionDoc>,
    private readonly recurringTransactions: Collection<RecurringTransactionDoc>
  ) {}

  /**
   * Query the Transaction collection with a simple .find(...) style query.
   */
  async queryTransactions(
    request: MqlFindRequest
  ): Promise<ServiceResult<MqlFindResponse<TransactionDoc>>> {
    try {
      const { userId, filter = {}, sort, limit, offset } = request;

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
  async queryRecurringTransactions(
    request: MqlFindRequest
  ): Promise<ServiceResult<MqlFindResponse<RecurringTransactionDoc>>> {
    try {
      const { userId, filter = {}, sort, limit, offset } = request;

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

export async function createMqlSearchService(): Promise<MqlSearchService> {
  const manager = MongoClientManager.fromEnv();

  const [transactions, recurringTransactions] = await Promise.all([
    manager.getTransactionCollection(),
    manager.getRecurringTransactionCollection(),
  ]);

  return new MqlSearchService(transactions, recurringTransactions);
}