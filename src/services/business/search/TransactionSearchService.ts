import { failure, success } from "../../../types/serviceResult";
import { TransactionSearchRequestWithText, TransactionSearchResultSR, RecurringSearchRequestWithText, RecurringSearchResultSR, RecurringSearchData } from "./searchTypes";
import { MqlFilter, TransactionQueryService } from "../../infrastructure/database/TransactionQueryService";
import { TransactionEmbeddingService } from "../../ai/embedding/transactionEmbeddingService";
import { UserContextProvider } from "../../../lib/UserContextProvider";

const SEMANTIC_TOP_K = 200;

export class TransactionSearchService {
  constructor(
    private readonly userContext: UserContextProvider,
    private readonly queryService: TransactionQueryService,
    private readonly embeddingService: TransactionEmbeddingService
  ) {}

  /**
   * Apply semantic search filter to the base filter if textQuery provided
   * Shared logic for both transaction types
   * @returns Updated filter with semantic IDs, or error result if semantic search failed
   */
  private async applySemanticFilter<TResult>(
    textQuery: string | undefined,
    baseFilter: MqlFilter,
    emptyMessageSuffix: string
  ): Promise<{ filter?: MqlFilter; error?: TResult }> {
    if (!textQuery || textQuery.trim().length === 0) {
      return { filter: baseFilter };
    }

    const semanticRes = await this.embeddingService.searchTransactionsByDescription(
      textQuery,
      SEMANTIC_TOP_K
    );

    if (!semanticRes.success || !semanticRes.data) {
      return {
        error: failure(
          `Failed to run semantic ${emptyMessageSuffix} search`,
          "SEMANTIC_SEARCH_ERROR",
          semanticRes.error?.details
        ) as TResult,
      };
    }

    const ids = semanticRes.data.map((hit) => hit.transaction.id);

    if (ids.length === 0) {
      return {
        error: success(
          { documents: [], total: 0 },
          `No ${emptyMessageSuffix} matched the semantic query`,
          [`No semantic matches for textQuery="${textQuery}"`]
        ) as TResult,
      };
    }

    return {
      filter: {
        ...baseFilter,
        _id: { $in: ids },
      },
    };
  }

  /**
   * Transaction search combining semantic and structured queries.
   * Combines optional textQuery (semantic) + MQL filter in a single call.
   */
  async queryTransactions(
    request: TransactionSearchRequestWithText
  ): Promise<TransactionSearchResultSR> {
    const { textQuery, ...rest } = request;
    const userId = this.userContext.getUserId();

    const semanticResult = await this.applySemanticFilter<TransactionSearchResultSR>(
      textQuery,
      rest.filter ?? {},
      "transactions"
    );

    if (semanticResult.error) {
      return semanticResult.error;
    }

    // Delegate to query service (already returns ServiceResult)
    return this.queryService.queryTransactions(userId, {
      filter: semanticResult.filter!,
      sort: rest.sort,
      limit: rest.limit,
      offset: rest.offset,
    });
  }

  /**
   * Recurring transaction search combining semantic and structured queries.
   * Combines optional textQuery (semantic) + MQL filter in a single call.
   */
  async queryRecurringTransactions(
    request: RecurringSearchRequestWithText
  ): Promise<RecurringSearchResultSR> {
    const { textQuery, ...rest } = request;
    const userId = this.userContext.getUserId();

    const semanticResult = await this.applySemanticFilter<RecurringSearchResultSR>(
      textQuery,
      rest.filter ?? {},
      "recurring transactions"
    );

    if (semanticResult.error) {
      return semanticResult.error;
    }

    return this.queryService.queryRecurringTransactions(userId, {
      filter: semanticResult.filter!,
      sort: rest.sort,
      limit: rest.limit,
      offset: rest.offset,
    });
  }
}
