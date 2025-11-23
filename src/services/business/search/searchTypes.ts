import { ServiceResult } from "../../../types/serviceResult";
import { Document } from "mongodb";

export interface TransactionAggregationRequest {
  /**
   * AI-generated MongoDB aggregation pipeline
   * Service will prepend { $match: { userId } } for security
   * Service will enforce sane $limit (clamp to max, add default if missing)
   */
  pipeline: Document[];
  
  /**
   * Optional semantic pre-filter
   */
  textQuery?: string;
}

export interface RecurringAggregationRequest {
  pipeline: Document[];
  textQuery?: string;
}

export type AggregationData = Document[];
export type TransactionAggregationResultSR = ServiceResult<AggregationData>;
export type RecurringAggregationResultSR = ServiceResult<AggregationData>;
