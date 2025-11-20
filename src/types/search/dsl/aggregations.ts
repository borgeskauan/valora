export type GroupByField =
  | "date"
  | "day"
  | "month"
  | "year"
  | "category"
  | "type";

export type Metric = "count" | "sum" | "avg" | "min" | "max";

export interface AggregationRequest {
  groupBy: GroupByField[];
  metrics: Metric[];
  label?: string;
}

export interface AggregationRow {
  group: Record<string, string | number>;
  metrics: Record<string, number>;
}