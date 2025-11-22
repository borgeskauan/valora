import { failure, success } from "../../../types/ServiceResult";
import { TransactionSearchRequestWithText, TransactionSearchResultSR, RecurringSearchRequestWithText, RecurringSearchResultSR, RecurringSearchData } from "./embeddingSearchTypes";
import { MqlFilter, MqlSearchService } from "./mql/MqlSearchService";
import { TransactionDescriptionSearchService } from "./SemanticSearchService";

const SEMANTIC_TOP_K = 200;

export class AiSearchService {
  constructor(
    private readonly mql: MqlSearchService,
    private readonly txSemantic: TransactionDescriptionSearchService
  ) {}

  /**
   * AI-facing transaction search.
   * Combines optional textQuery (semantic) + MQL filter in a single call.
   */
  async queryTransactions(
    request: TransactionSearchRequestWithText
  ): Promise<TransactionSearchResultSR> {
    const { userId, textQuery, ...rest } = request;

    let mergedFilter: MqlFilter = rest.filter ?? {};

    if (textQuery && textQuery.trim().length > 0) {
      const semanticRes =
        await this.txSemantic.searchTransactionsByDescription(
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

    // Delegate to MQL service (already returns ServiceResult)
    return this.mql.queryTransactions({
      userId,
      filter: mergedFilter,
      sort: rest.sort,
      limit: rest.limit,
      offset: rest.offset,
    });
  }

  async queryRecurringTransactions(
    request: RecurringSearchRequestWithText
  ): Promise<RecurringSearchResultSR> {
    const { userId, textQuery, ...rest } = request;

    let mergedFilter: MqlFilter = rest.filter ?? {};

    if (textQuery && textQuery.trim().length > 0) {
      const semanticRes =
        await this.txSemantic.searchTransactionsByDescription(
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

    return this.mql.queryRecurringTransactions({
      userId,
      filter: mergedFilter,
      sort: rest.sort,
      limit: rest.limit,
      offset: rest.offset,
    });
  }
}
