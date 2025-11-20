// Range helpers
export interface DateRange {
  /**
   * Inclusive start (YYYY-MM-DD or full ISO)
   */
  from?: string;
  /**
   * Inclusive end (YYYY-MM-DD or full ISO).
   * Implementation should turn this into < nextDay for whole-day queries.
   */
  to?: string;
}

export interface AmountRange {
  min?: number;
  max?: number;
}

export type SortField =
  | "date"
  | "amount"
  | "category"
  | "type"
  | "semanticScore"
  | "id";

export type SortDirection = "asc" | "desc";