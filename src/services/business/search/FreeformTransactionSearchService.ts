import { failure, success } from "../../../types/serviceResult";
import { 
  TransactionAggregationRequest,
  RecurringAggregationRequest,
  TransactionAggregationResultSR,
  RecurringAggregationResultSR
} from "./searchTypes";
import { MqlTransactionSearchService } from "../../infrastructure/database/MqlTransactionSearchService";
import { TransactionEmbeddingService } from "../../ai/embedding/TransactionEmbeddingService";

const SEMANTIC_TOP_K = 200;

export class FreeformTransactionSearchService {
  constructor(
    private readonly queryService: MqlTransactionSearchService,
    private readonly embeddingService: TransactionEmbeddingService
  ) {}

  /**
   * Run aggregation pipeline on transactions
   * AI has full control over pipeline, service enforces userId and limits
   * Supports optional semantic pre-filtering via textQuery
   */
  async aggregateTransactions(
    userId: string,
    request: TransactionAggregationRequest
  ): Promise<TransactionAggregationResultSR> {
    const { textQuery, pipeline } = request;

    // Path 1: No semantic pre-filter (direct aggregation)
    if (!textQuery || textQuery.trim().length === 0) {
      return this.queryService.aggregateTransactions(userId, pipeline);
    }

    // Path 2: With semantic pre-filter
    const semanticRes = await this.embeddingService.searchTransactionsByDescription(
      userId,
      textQuery,
      SEMANTIC_TOP_K
    );

    if (!semanticRes.success || !semanticRes.data) {
      return failure(
        "Failed to run semantic search for aggregation",
        "SEMANTIC_SEARCH_ERROR",
        semanticRes.error?.details
      );
    }

    const ids = semanticRes.data.map(m => m.id);

    if (ids.length === 0) {
      return success(
        [],
        "No transactions matched semantic query",
        [`No semantic matches for textQuery="${textQuery}"`]
      );
    }

    // Prepend $match stage with semantic IDs
    const filteredPipeline = [
      { $match: { _id: { $in: ids } } },
      ...pipeline
    ];

    return this.queryService.aggregateTransactions(userId, filteredPipeline);
  }

  /**
   * Run aggregation pipeline on recurring transactions
   */
  async aggregateRecurringTransactions(
    userId: string,
    request: RecurringAggregationRequest
  ): Promise<RecurringAggregationResultSR> {
    const { textQuery, pipeline } = request;

    if (!textQuery || textQuery.trim().length === 0) {
      return this.queryService.aggregateRecurringTransactions(userId, pipeline);
    }

    const semanticRes = await this.embeddingService.searchTransactionsByDescription(
      userId,
      textQuery,
      SEMANTIC_TOP_K
    );

    if (!semanticRes.success || !semanticRes.data) {
      return failure(
        "Failed to run semantic search for aggregation",
        "SEMANTIC_SEARCH_ERROR",
        semanticRes.error?.details
      );
    }

    const ids = semanticRes.data.map(m => m.id);

    if (ids.length === 0) {
      return success(
        [],
        "No recurring transactions matched semantic query"
      );
    }

    const filteredPipeline = [
      { $match: { _id: { $in: ids } } },
      ...pipeline
    ];

    return this.queryService.aggregateRecurringTransactions(userId, filteredPipeline);
  }
}
