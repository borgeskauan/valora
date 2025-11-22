import { ServiceResult } from "../../../types/serviceResult";
import { MqlFindRequest, MqlFindResponse } from "../../infrastructure/database/TransactionQueryService";
import { TransactionDoc, RecurringTransactionDoc } from "../../infrastructure/database/schemas";

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
