import { failure, success } from "../../../types/serviceResult";
import { TransactionSearchRequestWithText, TransactionSearchResultSR, RecurringSearchRequestWithText, RecurringSearchResultSR, RecurringSearchData } from "./searchTypes";
import { MqlFilter, FreeformTransactionSearchService } from "../../infrastructure/database/FreeformTransactionSearchService";
import { TransactionEmbeddingService } from "../../ai/embedding/transactionEmbeddingService";

const SEMANTIC_TOP_K = 200;

export class TransactionSearchService {
  constructor(
    private readonly queryService: FreeformTransactionSearchService,
    private readonly embeddingService: TransactionEmbeddingService
  ) {}

  /**
   * Transaction search combining semantic and structured queries.
   * Combines optional textQuery (semantic) + MQL filter in a single call.
   */
  async searchTransactions(
    userId: string,
    request: TransactionSearchRequestWithText
  ): Promise<TransactionSearchResultSR> {
    const { textQuery, ...rest } = request;

    let mergedFilter: MqlFilter = rest.filter ?? {};

    if (textQuery && textQuery.trim().length > 0) {
      const semanticRes =
        await this.embeddingService.searchTransactionsByDescription(
          userId,
          textQuery,
          SEMANTIC_TOP_K
        );

      if (!semanticRes.success || !semanticRes.data) {
        return failure(
          "Failed to run semantic transaction search",
          "SEMANTIC_SEARCH_ERROR",
          semanticRes.error?.details
        );
      }

      const ids = semanticRes.data.map((hit) => hit.transaction.id);

      if (ids.length === 0) {
        return success(
          { documents: [], total: 0 },
          "No transactions matched the semantic query",
          [`No semantic matches for textQuery="${textQuery}"`]
        );
      }

      mergedFilter = {
        ...mergedFilter,
        _id: { $in: ids },
      };
    }

    // Delegate to query service (already returns ServiceResult)
    return this.queryService.searchTransactions(userId, {
      filter: mergedFilter,
      sort: rest.sort,
      limit: rest.limit,
      offset: rest.offset,
    });
  }

  async searchRecurringTransactions(
    userId: string,
    request: RecurringSearchRequestWithText
  ): Promise<RecurringSearchResultSR> {
    const { textQuery, ...rest } = request;

    let mergedFilter: MqlFilter = rest.filter ?? {};

    if (textQuery && textQuery.trim().length > 0) {
      const semanticRes =
        await this.embeddingService.searchTransactionsByDescription(
          userId,
          textQuery,
          SEMANTIC_TOP_K
        );

      if (!semanticRes.success || !semanticRes.data) {
        return failure<RecurringSearchData>(
          "Failed to run semantic recurring search",
          "SEMANTIC_SEARCH_ERROR",
          semanticRes.error?.details
        );
      }

      // Here we treat hit.transaction.id as RecurringTransaction._id
      const ids = semanticRes.data.map((hit) => hit.transaction.id);

      if (ids.length === 0) {
        return success<RecurringSearchData>(
          { documents: [], total: 0 },
          "No recurring transactions matched the text query"
        );
      }

      mergedFilter = {
        ...mergedFilter,
        _id: { $in: ids },
      };
    }

    return this.queryService.searchRecurringTransactions(userId, {
      filter: mergedFilter,
      sort: rest.sort,
      limit: rest.limit,
      offset: rest.offset,
    });
  }
}
