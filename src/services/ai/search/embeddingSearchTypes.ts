import { ServiceResult } from "../../../types/ServiceResult";
import { MqlFindRequest, MqlFindResponse } from "./mql/MqlSearchService";
import { TransactionDoc, RecurringTransactionDoc } from "./mql/schemas";

export interface TransactionSearchRequestWithText extends MqlFindRequest {
  /**
   * Optional natural-language query for semantic matching.
   * Example: "uber rides", "coffee purchases", "netflix subscription".
   */
  textQuery?: string;
}

export interface RecurringSearchRequestWithText extends MqlFindRequest {
  /**
   * Optional natural-language query for semantic matching of subscriptions.
   * Example: "streaming services", "music subscription".
   */
  textQuery?: string;
}

export type TransactionSearchData = MqlFindResponse<TransactionDoc>;
export type RecurringSearchData = MqlFindResponse<RecurringTransactionDoc>;

export type TransactionSearchResultSR = ServiceResult<TransactionSearchData>;
export type RecurringSearchResultSR = ServiceResult<RecurringSearchData>;
