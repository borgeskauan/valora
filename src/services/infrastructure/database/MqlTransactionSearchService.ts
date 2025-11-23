import { Collection, Document } from "mongodb";
import {
  TransactionDoc,
  RecurringTransactionDoc,
} from "./schemas";

import { failure, ServiceResult, success } from "../../../types/serviceResult";

const MAX_LIMIT = 1000;
const DEFAULT_LIMIT = 100;

export class MqlTransactionSearchService {
  constructor(
    private readonly transactions: Collection<TransactionDoc>,
    private readonly recurringTransactions: Collection<RecurringTransactionDoc>
  ) {}

  /**
   * Enforce sane limit on aggregation pipeline
   * Clamps existing $limit stages and adds default if missing
   */
  private enforceSaneLimit(pipeline: Document[]): Document[] {
    let hasLimit = false;
    
    const limitedPipeline = pipeline.map(stage => {
      if (stage.$limit !== undefined) {
        hasLimit = true;
        return { $limit: Math.min(stage.$limit, MAX_LIMIT) };
      }
      return stage;
    });
    
    if (!hasLimit) {
      limitedPipeline.push({ $limit: DEFAULT_LIMIT });
    }
    
    return limitedPipeline;
  }

  /**
   * Run aggregation pipeline on Transaction collection
   * AI has full control over pipeline, service only enforces userId and limits
   */
  async aggregateTransactions(
    userId: string,
    pipeline: Document[]
  ): Promise<ServiceResult<Document[]>> {
    try {
      // Enforce userId (security)
      const securedPipeline = [
        { $match: { userId } },
        ...pipeline
      ];
      
      // Enforce sane limit (resource protection)
      const limitedPipeline = this.enforceSaneLimit(securedPipeline);
      
      // Execute (hands off)
      const cursor = this.transactions.aggregate(limitedPipeline);
      const results = await cursor.toArray();
      
      return success(results, "Aggregation executed successfully");
    } catch (err) {
      const details = err instanceof Error ? err.message : "Unknown aggregation error";
      return failure("Failed to execute aggregation", "AGGREGATION_ERROR", details);
    }
  }

  /**
   * Run aggregation pipeline on RecurringTransaction collection
   */
  async aggregateRecurringTransactions(
    userId: string,
    pipeline: Document[]
  ): Promise<ServiceResult<Document[]>> {
    try {
      const securedPipeline = [
        { $match: { userId } },
        ...pipeline
      ];
      
      const limitedPipeline = this.enforceSaneLimit(securedPipeline);
      
      const cursor = this.recurringTransactions.aggregate(limitedPipeline);
      const results = await cursor.toArray();
      
      return success(results, "Aggregation executed successfully");
    } catch (err) {
      const details = err instanceof Error ? err.message : "Unknown aggregation error";
      return failure("Failed to execute aggregation", "AGGREGATION_ERROR", details);
    }
  }
}