import { ServiceResult } from "../../../types/ServiceResult";

export interface TransactionData {
  id: string;
  amount: number;
  category: string;
  description: string | null;
  date: string;    // ISO-8601
  type: string;    // "expense" | "income"
}

export interface TransactionSearchResult {
  transaction: TransactionData;
  score: number;
  kind: "onetime" | "recurring";
}

export interface TransactionDescriptionSearchService {
  /**
   * Existing semantic search over transactions (your implementation).
   * It should already be scoped to the current user internally.
   */
  searchTransactionsByDescription(
    query: string,
    k?: number
  ): Promise<ServiceResult<TransactionSearchResult[]>>;
}
