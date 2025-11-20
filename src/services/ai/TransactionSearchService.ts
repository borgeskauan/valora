// TransactionSearchService.ts
import { Prisma, PrismaClient } from "../../generated/prisma";
import { PrismaClientManager } from "../../lib/PrismaClientManager";
import { ServiceResult, success, failure } from "../../types/ServiceResult";
import { TransactionEmbeddingService } from "./embedding/transactionEmbeddingService";
import { UserContextProvider } from "../../lib/UserContextProvider";
import {
  AggregationRequest,
  AggregationRow,
} from "../../types/search/dsl/aggregations";
import { SortField, SortDirection } from "../../types/search/dsl/core";
import { PresentationOptions } from "../../types/search/dsl/presentation";
import { TransactionSearchFilters } from "../../types/search/dsl/transaction";
import {
  TransactionSearchRequest,
  RecurringTransactionSearchRequest,
} from "../../types/search/service/request";
import {
  TransactionSearchResponse,
  RecurringTransactionSearchResponse,
} from "../../types/search/service/response";
import { ITransactionSearchService } from "../../types/search/service/service";
import { RecurringTransactionSearchHitDisplay, TransactionSearchHitDisplay } from "../../types/search/dsl/display";

// ------------------------------
// Constants & helpers
// ------------------------------

const DEFAULT_LIMIT = 50;
const DEFAULT_OFFSET = 0;
const DEFAULT_LOCALE = "en-US";
const DEFAULT_TIMEZONE = "UTC";
const DEFAULT_DATE_STYLE: PresentationOptions["dateStyle"] = "medium";
const DEFAULT_CURRENCY = "USD";

// Cap semantic candidate list to avoid oversized $in arrays.
const MAX_EMBED_CANDIDATES = 200;

function isDateOnly(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}
function isoAtStartOfDayUTC(yyyyMmDd: string): string {
  // We normalize date-only bounds in UTC (query timezone stays neutral;
  // formatting uses requested timezone).
  return `${yyyyMmDd}T00:00:00.000Z`;
}
function nextDayIsoUTC(yyyyMmDd: string): string {
  const dt = new Date(`${yyyyMmDd}T00:00:00.000Z`);
  dt.setUTCDate(dt.getUTCDate() + 1);
  return dt.toISOString();
}

// Normalize DateRange per spec: inclusive `to` for day-only → < next day.
function normalizeDateRange(range: {
  from?: string;
  to?: string;
}): { $gte?: string; $lte?: string; $lt?: string } | undefined {
  if (!range?.from && !range?.to) return undefined;

  const out: { $gte?: string; $lte?: string; $lt?: string } = {};

  if (range.from) {
    out.$gte = isDateOnly(range.from)
      ? isoAtStartOfDayUTC(range.from)
      : new Date(range.from).toISOString();
  }
  if (range.to) {
    if (isDateOnly(range.to)) {
      out.$lt = nextDayIsoUTC(range.to);
    } else {
      // Full ISO `to` remains inclusive as provided.
      out.$lte = new Date(range.to).toISOString();
    }
  }
  return out;
}

// Map SortField → Mongo field
function mapSortField(field: SortField): string {
  switch (field) {
    case "date":
      return "date";
    case "amount":
      return "amount";
    case "category":
      return "category";
    case "type":
      return "type";
    case "semanticScore":
      return "semanticScore";
    case "id":
      return "_id";
    default:
      return "date";
  }
}

type Bson = Record<string, unknown>;
type Stage = Bson;

// ------------------------------
// Planner – pipeline builder
// ------------------------------

interface PlanBuildInput {
  userId: string;
  filters?: TransactionSearchFilters;
  aggregation?: AggregationRequest;
  limit?: number;
  offset?: number;
  sort?: { field: SortField; direction: SortDirection }[];
  presentation?: PresentationOptions;

  // Semantic search
  semanticMode?: boolean; // true when filters.text is supplied
  semanticIds?: string[]; // candidate one-time transaction ids
  semanticScores?: number[]; // parallel to semanticIds
}
function buildRawPipeline(input: PlanBuildInput) {
  const {
    userId,
    filters,
    aggregation,
    limit = DEFAULT_LIMIT,
    offset = DEFAULT_OFFSET,
    sort,
    presentation,
    semanticMode,
    semanticIds,
    semanticScores,
  } = input;

  const match: Bson = { userId };

  // ids
  if (filters?.ids && filters.ids.length > 0) {
    match._id = { $in: filters.ids };
  }

  // categories
  if (filters?.categories?.length) {
    match.category = { $in: filters.categories };
  }

  // types
  if (filters?.types?.length) {
    match.type = { $in: filters.types };
  }

  // amount range
  if (filters?.amountRange) {
    const ar: Bson = {};
    if (typeof filters.amountRange.min === "number")
      ar.$gte = filters.amountRange.min;
    if (typeof filters.amountRange.max === "number")
      ar.$lte = filters.amountRange.max;
    if (Object.keys(ar).length > 0) match.amount = ar;
  }

  // date range
  if (filters?.dateRange) {
    const dr = normalizeDateRange(filters.dateRange);
    if (dr) match.date = dr;
  }

  // kinds
  if (filters?.kinds?.length) {
    const includeOneTime = filters.kinds.includes("oneTime");
    const includeRecurring = filters.kinds.includes("recurring");
    if (includeOneTime && !includeRecurring) {
      match.$or = [
        { recurringTransactionId: { $exists: false } },
        { recurringTransactionId: null },
      ];
    } else if (!includeOneTime && includeRecurring) {
      match.recurringTransactionId = { $ne: null };
    }
  }

  const pipeline: Stage[] = [];

  // SEMANTIC TEXT FILTERING (no regex fallback):
  // If semanticMode=true, enforce _id in semanticIds (or [] when none -> zero results).
  const addFields: Stage[] = [];
  if (semanticMode) {
    const candidates = semanticIds ?? [];

    // Intersect with pre-existing _id $in (if any)
    if ((match._id as any)?.$in) {
      const prev = new Set<string>((match._id as any).$in);
      const inter = candidates.filter((id) => prev.has(id));
      match._id = { $in: inter };
    } else {
      match._id = { $in: candidates };
    }

    if (candidates.length > 0 && semanticScores?.length === candidates.length) {
      addFields.push({
        $addFields: {
          semanticScore: {
            $let: {
              vars: { ids: candidates, scores: semanticScores },
              in: {
                $cond: [
                  { $gte: [{ $indexOfArray: ["$$ids", "$_id"] }, 0] },
                  {
                    $arrayElemAt: [
                      "$$scores",
                      { $indexOfArray: ["$$ids", "$_id"] },
                    ],
                  },
                  null,
                ],
              },
            },
          },
        },
      });
    }
  }

  pipeline.push({ $match: match });
  pipeline.push({ $addFields: { dateObj: { $toDate: "$date" } } });
  pipeline.push(...addFields);

  // Facet: results / total / aggregates (unchanged)
  const resultsPipeline: Stage[] = [];
  if (sort?.length) {
    const sortObj: Bson = {};
    for (const s of sort)
      sortObj[mapSortField(s.field)] = s.direction === "asc" ? 1 : -1;
    resultsPipeline.push({ $sort: sortObj });
  } else {
    resultsPipeline.push({ $sort: { date: -1, _id: 1 } });
  }

  if (offset > 0) resultsPipeline.push({ $skip: offset });
  resultsPipeline.push({ $limit: Math.max(0, Math.min(limit, 1000)) });

  resultsPipeline.push({
    $project: {
      _id: 1,
      date: 1,
      amount: 1,
      category: 1,
      description: 1,
      type: 1,
      recurringTransactionId: 1,
      semanticScore: 1,
    },
  });

  const totalPipeline: Stage[] = [{ $count: "value" }];
  const aggregatesPipeline: Stage[] = buildAggregatesFacet(
    aggregation,
    presentation
  );

  pipeline.push({
    $facet: {
      results: resultsPipeline,
      total: totalPipeline,
      aggregates: aggregatesPipeline,
    },
  });

  return pipeline;
}

// Build group-by metrics facet
function buildAggregatesFacet(
  aggregation?: AggregationRequest,
  presentation?: PresentationOptions
): Stage[] {
  if (!aggregation) return [];

  const tz = presentation?.timezone || DEFAULT_TIMEZONE;
  const groupBy: Record<string, unknown> = {};

  // Normalize date-derived keys via $dateToString for stable labels.
  const dateKeyDay = {
    $dateToString: { date: "$dateObj", timezone: tz, format: "%Y-%m-%d" },
  };
  const dateKeyMonth = {
    $dateToString: { date: "$dateObj", timezone: tz, format: "%Y-%m" },
  };
  const dateKeyYear = {
    $dateToString: { date: "$dateObj", timezone: tz, format: "%Y" },
  };

  for (const key of aggregation.groupBy) {
    switch (key) {
      case "date":
      case "day":
        groupBy.day = dateKeyDay;
        break;
      case "month":
        groupBy.month = dateKeyMonth;
        break;
      case "year":
        groupBy.year = dateKeyYear;
        break;
      case "category":
        groupBy.category = "$category";
        break;
      case "type":
        groupBy.type = "$type";
        break;
    }
  }

  // Metrics
  const metrics: Record<string, unknown> = {};
  for (const m of aggregation.metrics) {
    switch (m) {
      case "count":
        metrics.count = { $sum: 1 };
        break;
      case "sum":
        metrics.sum = { $sum: "$amount" };
        break;
      case "avg":
        metrics.avg = { $avg: "$amount" };
        break;
      case "min":
        metrics.min = { $min: "$amount" };
        break;
      case "max":
        metrics.max = { $max: "$amount" };
        break;
    }
  }

  const stages: Stage[] = [
    {
      $group: {
        _id: groupBy,
        ...metrics,
      },
    },
    {
      $project: {
        _id: 0,
        group: "$_id",
        metrics: Object.fromEntries(
          Object.keys(metrics).map((k) => [k, `$${k}`])
        ),
      },
    },
  ];

  // Optional deterministic order for aggregates
  stages.push({
    $sort: {
      "group.year": 1,
      "group.month": 1,
      "group.day": 1,
      "group.category": 1,
      "group.type": 1,
    },
  });

  return stages;
}

// ------------------------------
// Executor – DB + semantic fusion
// ------------------------------

export class TransactionSearchService implements ITransactionSearchService {
  private prisma: PrismaClient;

  constructor() {
    this.prisma = PrismaClientManager.getClient();
  }

  public async searchTransactions(
    userId: string,
    request: TransactionSearchRequest
  ): Promise<ServiceResult<TransactionSearchResponse>> {
    const warnings: string[] = [];
    try {
      let semanticMode = false;
      let semanticIds: string[] | undefined;
      let semanticScores: number[] | undefined;

      const textQuery = request.filters?.text?.trim();
      if (textQuery) {
        semanticMode = true;

        const embeddingService = new TransactionEmbeddingService(
          new UserContextProvider(userId)
        );

        const res = await embeddingService.searchTransactionsByDescription(
          textQuery,
          MAX_EMBED_CANDIDATES
        );

        if (res.success && res.data) {
          const hits = res.data;
          if (hits.length > 0) {
            const top = hits.slice(0, MAX_EMBED_CANDIDATES);
            semanticIds = top.map((h) => h.transaction.id);
            semanticScores = top.map((h) => h.score);
          } else {
            // No candidates: semantic-only ⇒ zero hits (via $in: [])
            warnings.push("No semantic matches found for the provided text.");
            semanticIds = []; // enforce empty candidate set
            semanticScores = []; // keep array alignment
          }
        } else {
          // Embedding service failed: still semantic-only ⇒ zero hits
          warnings.push(
            `Semantic search unavailable: ${res.message}${
              res.error?.code ? ` (${res.error.code})` : ""
            }. Returning zero results for text filter.`
          );
          semanticIds = [];
          semanticScores = [];
        }
      }

      const pipeline = buildRawPipeline({
        userId,
        filters: request.filters,
        aggregation: request.aggregation,
        limit: request.limit ?? DEFAULT_LIMIT,
        offset: request.offset ?? DEFAULT_OFFSET,
        sort: request.sort,
        presentation: request.presentation,
        semanticMode,
        semanticIds,
        semanticScores,
      });

      console.log(
        "[TransactionSearch] Executing pipeline:",
        JSON.stringify(pipeline, null, 2)
      );

      const raw = await this.prisma.transaction.aggregateRaw({
        pipeline: pipeline as any[],
      });
      const facetDoc = Array.isArray(raw) ? (raw[0] as any) : raw;

      console.log(
        "[TransactionSearch] Raw facet document:",
        JSON.stringify(facetDoc, null, 2)
      );

      const hitsRaw = (facetDoc?.results ?? []) as any[];
      const total = Number(facetDoc?.total?.[0]?.value ?? 0);
      const aggregatesRaw = (facetDoc?.aggregates ?? []) as any[];

      const response: TransactionSearchResponse = {
        hits: hitsRaw.map((doc) => toDisplayHit(doc, request.presentation)),
        total,
        aggregates:
          request.aggregation && Array.isArray(aggregatesRaw)
            ? (aggregatesRaw as AggregationRow[])
            : undefined,
      };

      return success(
        response,
        "Search completed",
        warnings.length ? warnings : undefined
      );
    } catch (err) {
      return failure<TransactionSearchResponse>(
        "Failed to search transactions",
        "SEARCH_PIPELINE_ERROR",
        err instanceof Error ? err.stack || err.message : String(err)
      );
    }
  }

  public async searchRecurringTransactions(
    userId: string,
    request: RecurringTransactionSearchRequest
  ): Promise<ServiceResult<RecurringTransactionSearchResponse>> {
    const warnings: string[] = [];
    try {
      // --- Semantic candidate building (recurring ID space) ---
      let semanticMode = false;
      let recurringIdToScore = new Map<string, number>();

      const text = request.filters?.text?.trim();
      if (text) {
        semanticMode = true;

        const embeddingService = new TransactionEmbeddingService(
          new UserContextProvider(userId)
        );
        const res = await embeddingService.searchTransactionsByDescription(
          text,
          MAX_EMBED_CANDIDATES
        );

        if (res.success && res.data) {
          for (const h of res.data) {
            const prev =
              recurringIdToScore.get(h.transaction.id) ?? -Infinity;
            if (h.score > prev)
              recurringIdToScore.set(h.transaction.id, h.score);
          }
        } else {
          warnings.push(
            `Semantic search unavailable: ${res.message}${
              res.error?.code ? ` (${res.error.code})` : ""
            }. Returning zero results for text filter.`
          );
        }
      }

      // Extract aligned arrays for pipeline injection
      const semanticRecurringIds = Array.from(recurringIdToScore.keys()).slice(
        0,
        MAX_EMBED_CANDIDATES
      );
      const semanticRecurringScores = semanticRecurringIds.map(
        (id) => recurringIdToScore.get(id)!
      );

      // If semanticMode and no candidates -> enforce zero hits (semantic-only)
      const pipeline = buildRecurringPipeline({
        userId,
        filters: request.filters,
        aggregation: request.aggregation,
        limit: request.limit ?? DEFAULT_LIMIT,
        offset: request.offset ?? DEFAULT_OFFSET,
        sort: request.sort,
        presentation: request.presentation,
        includeRawTransactions: request.includeRawTransactions,
        rawTransactionsAggregation: request.rawTransactionsAggregation,
        semanticMode,
        semanticRecurringIds,
        semanticRecurringScores,
      });

      const raw = await this.prisma.recurringTransaction.aggregateRaw({
        pipeline,
      });
      const facetDoc = Array.isArray(raw) ? (raw[0] as any) : raw;

      const hitsRaw = (facetDoc?.results ?? []) as any[];
      const total = Number(facetDoc?.total?.[0]?.value ?? 0);
      const aggregatesRaw = (facetDoc?.aggregates ?? []) as any[];

      const response: RecurringTransactionSearchResponse = {
        hits: hitsRaw.map((doc) =>
          toRecurringDisplayHit(doc, request.presentation)
        ),
        total,
        aggregates:
          request.aggregation && Array.isArray(aggregatesRaw)
            ? (aggregatesRaw as AggregationRow[])
            : undefined,
      };

      return success(
        response,
        "Recurring search completed",
        warnings.length ? warnings : undefined
      );
    } catch (err) {
      return failure<RecurringTransactionSearchResponse>(
        "Failed to search recurring transactions",
        "RECURRING_SEARCH_ERROR",
        err instanceof Error ? err.stack || err.message : String(err)
      );
    }
  }
}

// ------------------------------
// Formatter
// ------------------------------

function toDisplayHit(doc: any, presentation?: PresentationOptions) {
  const locale = presentation?.locale || DEFAULT_LOCALE;
  const timezone = presentation?.timezone || DEFAULT_TIMEZONE;
  const dateStyle = presentation?.dateStyle || DEFAULT_DATE_STYLE;
  const includeTime = presentation?.includeTime || false;
  const currencyCode = presentation?.currencyCode || DEFAULT_CURRENCY;

  const date = new Date(doc.date);
  const formattedDate = new Intl.DateTimeFormat(locale, {
    timeZone: timezone,
    dateStyle,
    ...(includeTime ? { timeStyle: "short" } : {}),
  }).format(date);

  const formattedAmount = new Intl.NumberFormat(locale, {
    style: "currency",
    currency: currencyCode,
  }).format(doc.amount);

  const typeLabel = doc.type === "income" ? "Income" : "Expense";

  const isRecurring = !!doc.recurringTransactionId;

  return {
    id: doc._id as string,
    isRecurring,
    display: {
      formattedDate,
      formattedAmount,
      category: doc.category,
      description: doc.description ?? null,
      typeLabel,
    },
  } as const;
}

// ------------------------------------
// Recurring: sort field mapping
// ------------------------------------
function mapSortFieldRecurring(field: SortField): string {
  switch (field) {
    case 'date':          return 'nextDue';        // choose nextDue as the primary "date"
    case 'amount':        return 'amount';
    case 'category':      return 'category';
    case 'type':          return 'type';
    case 'semanticScore': return 'semanticScore';
    case 'id':            return '_id';
    default:              return 'nextDue';
  }
}

// ------------------------------------
// Aggregates for recurring definitions
// (uses startDate as the date source)
// ------------------------------------
function buildRecurringAggregatesFacet(
  aggregation?: AggregationRequest,
  presentation?: PresentationOptions
): Stage[] {
  if (!aggregation) return [];

  const tz = presentation?.timezone || DEFAULT_TIMEZONE;
  const groupBy: Record<string, unknown> = {};

  const startDay = { $dateToString: { date: '$startDateObj', timezone: tz, format: '%Y-%m-%d' } };
  const startMonth = { $dateToString: { date: '$startDateObj', timezone: tz, format: '%Y-%m' } };
  const startYear = { $dateToString: { date: '$startDateObj', timezone: tz, format: '%Y' } };

  for (const key of aggregation.groupBy) {
    switch (key) {
      case 'date':
      case 'day':
        groupBy.day = startDay; break;
      case 'month':
        groupBy.month = startMonth; break;
      case 'year':
        groupBy.year = startYear; break;
      case 'category':
        groupBy.category = '$category'; break;
      case 'type':
        groupBy.type = '$type'; break;
    }
  }

  const metrics: Record<string, unknown> = {};
  for (const m of aggregation.metrics) {
    if (m === 'count') metrics.count = { $sum: 1 };
    if (m === 'sum')   metrics.sum = { $sum: '$amount' };
    if (m === 'avg')   metrics.avg = { $avg: '$amount' };
    if (m === 'min')   metrics.min = { $min: '$amount' };
    if (m === 'max')   metrics.max = { $max: '$amount' };
  }

  const stages: Stage[] = [
    { $group: { _id: groupBy, ...metrics } },
    {
      $project: {
        _id: 0,
        group: '$_id',
        metrics: Object.fromEntries(Object.keys(metrics).map(k => [k, `$${k}`])),
      }
    },
    { $sort: { 'group.year': 1, 'group.month': 1, 'group.day': 1, 'group.category': 1, 'group.type': 1 } }
  ];

  return stages;
}

// ------------------------------------
// Per‑subscription child aggregates
// (run inside a $lookup pipeline over Transaction)
// ------------------------------------
function buildChildAggregatesStages(
  aggregation: AggregationRequest,
  presentation?: PresentationOptions
): Stage[] {
  const tz = presentation?.timezone || DEFAULT_TIMEZONE;

  const groupBy: Record<string, unknown> = {};

  const day =   { $dateToString: { date: '$dateObj', timezone: tz, format: '%Y-%m-%d' } };
  const month = { $dateToString: { date: '$dateObj', timezone: tz, format: '%Y-%m' } };
  const year =  { $dateToString: { date: '$dateObj', timezone: tz, format: '%Y' } };

  for (const key of aggregation.groupBy) {
    switch (key) {
      case 'date':
      case 'day':  groupBy.day = day; break;
      case 'month': groupBy.month = month; break;
      case 'year':  groupBy.year = year; break;
      case 'category': groupBy.category = '$category'; break;
      case 'type':     groupBy.type = '$type'; break;
    }
  }

  const metrics: Record<string, unknown> = {};
  for (const m of aggregation.metrics) {
    if (m === 'count') metrics.count = { $sum: 1 };
    if (m === 'sum')   metrics.sum = { $sum: '$amount' };
    if (m === 'avg')   metrics.avg = { $avg: '$amount' };
    if (m === 'min')   metrics.min = { $min: '$amount' };
    if (m === 'max')   metrics.max = { $max: '$amount' };
  }

  const stages: Stage[] = [
    { $addFields: { dateObj: { $toDate: '$date' } } },
    { $group: { _id: groupBy, ...metrics } },
    {
      $project: {
        _id: 0,
        group: '$_id',
        metrics: Object.fromEntries(Object.keys(metrics).map(k => [k, `$${k}`])),
      }
    },
    { $sort: { 'group.year': 1, 'group.month': 1, 'group.day': 1, 'group.category': 1, 'group.type': 1 } }
  ];

  return stages;
}

// ------------------------------------
// Planner for recurring search
// ------------------------------------
interface RecurringPlanBuildInput {
  userId: string;
  filters?: RecurringTransactionSearchRequest['filters'];
  aggregation?: AggregationRequest;
  limit?: number;
  offset?: number;
  sort?: { field: SortField; direction: SortDirection }[];
  presentation?: PresentationOptions;

  // Options for children
  includeRawTransactions?: boolean;
  rawTransactionsAggregation?: AggregationRequest;

  // Semantic
  semanticMode?: boolean;
  semanticRecurringIds?: string[];     // candidates in RecurringTransaction space
  semanticRecurringScores?: number[];  // parallel scores array
}

function buildRecurringPipeline(input: RecurringPlanBuildInput): Prisma.InputJsonValue[] {
  const {
    userId, filters, aggregation,
    limit = DEFAULT_LIMIT, offset = DEFAULT_OFFSET,
    sort, presentation,
    includeRawTransactions,
    rawTransactionsAggregation,
    semanticMode,
    semanticRecurringIds,
    semanticRecurringScores,
  } = input;

  // Base match on recurring definitions
  const match: Stage = { userId };

  // ids
  if (filters?.ids?.length) {
    match._id = { $in: filters.ids };
  }

  // categories/types/amount on the recurring definition
  if (filters?.categories?.length) match.category = { $in: filters.categories };
  if (filters?.types?.length)      match.type = { $in: filters.types };
  if (filters?.amountRange) {
    const ar: Stage = {};
    if (typeof filters.amountRange.min === 'number') ar.$gte = filters.amountRange.min;
    if (typeof filters.amountRange.max === 'number') ar.$lte = filters.amountRange.max;
    if (Object.keys(ar).length) match.amount = ar;
  }

  // Recurring-specific filters
  const rf = filters?.recurring;
  if (rf?.frequencies?.length)   match.frequency = { $in: rf.frequencies };
  if (rf?.intervals?.length)     match.interval  = { $in: rf.intervals };
  if (rf?.daysOfWeek?.length)    match.dayOfWeek = { $in: rf.daysOfWeek };
  if (rf?.daysOfMonth?.length)   match.dayOfMonth = { $in: rf.daysOfMonth };
  if (rf?.monthsOfYear?.length)  match.monthOfYear = { $in: rf.monthsOfYear };
  if (rf?.startDateRange) {
    const dr = normalizeDateRange(rf.startDateRange);
    if (dr) match.startDate = dr as unknown as Stage;
  }
  if (rf?.nextDueRange) {
    const dr = normalizeDateRange(rf.nextDueRange);
    if (dr) match.nextDue = dr as unknown as Stage;
  }

  // Semantic text: restrict to candidate recurring IDs.
  const addFields: Stage[] = [];
  if (semanticMode) {
    const ids = semanticRecurringIds ?? [];
    match._id = { ...(match._id as Stage), $in: ids };

    if (ids.length && semanticRecurringScores?.length === ids.length) {
      addFields.push({
        $addFields: {
          semanticScore: {
            $let: {
              vars: { ids, scores: semanticRecurringScores },
              in: {
                $cond: [
                  { $gte: [{ $indexOfArray: ['$$ids', '$_id'] }, 0] },
                  { $arrayElemAt: ['$$scores', { $indexOfArray: ['$$ids', '$_id'] }] },
                  null,
                ],
              },
            },
          },
        },
      });
    }
  }

  const pipeline: Stage[] = [{ $match: match }];

  // Coerce dates for grouping/sort display
  pipeline.push({
    $addFields: {
      startDateObj: { $toDate: '$startDate' },
      nextDueObj: { $toDate: '$nextDue' },
    },
  });

  pipeline.push(...addFields);

  // Facets: results (paged), total, aggregates (over the full match)
  const results: Stage[] = [];

  // sort
  if (sort?.length) {
    const sortObj: Record<string, number> = {};
    for (const s of sort) sortObj[mapSortFieldRecurring(s.field)] = s.direction === 'asc' ? 1 : -1;
    results.push({ $sort: sortObj });
  } else {
    // Default listing: next due soonest first, then _id
    results.push({ $sort: { nextDue: 1, _id: 1 } });
  }

  if (offset > 0) results.push({ $skip: offset });
  results.push({ $limit: Math.max(0, Math.min(limit, 1000)) });

  // Child raw transactions / child aggregates
  // Optional date filter for children: reuse filters.dateRange if present (applies to children only here)
  let childDateStage: Stage | undefined;
  if (filters?.dateRange) {
    const cdr = normalizeDateRange(filters.dateRange);
    if (cdr) childDateStage = { date: cdr as unknown as Stage };
  }

  if (includeRawTransactions) {
    results.push({
      $lookup: {
        from: 'Transaction',
        let: { rid: '$_id' },
        pipeline: [
          {
            $match: {
              $expr: { $and: [
                { $eq: ['$recurringTransactionId', '$$rid'] },
                { $eq: ['$userId', userId] },
              ] },
            },
          },
          ...(childDateStage ? [{ $match: childDateStage }] : []),
          { $sort: { date: -1, _id: 1 } },
          { $limit: 200 }, // safety cap per subscription
          { $project: { _id: 1, date: 1, amount: 1, category: 1, description: 1, type: 1, recurringTransactionId: 1 } },
        ],
        as: 'rawTx',
      },
    } as Stage);
  }

  if (rawTransactionsAggregation) {
    const childAggStages = buildChildAggregatesStages(rawTransactionsAggregation, presentation);
    results.push({
      $lookup: {
        from: 'Transaction',
        let: { rid: '$_id' },
        pipeline: [
          {
            $match: {
              $expr: { $and: [
                { $eq: ['$recurringTransactionId', '$$rid'] },
                { $eq: ['$userId', userId] },
              ] },
            },
          },
          ...(childDateStage ? [{ $match: childDateStage }] : []),
          ...childAggStages,
        ],
        as: 'rawAgg',
      },
    } as Stage);
  }

  // project result fields
  results.push({
    $project: {
      _id: 1,
      amount: 1,
      category: 1,
      description: 1,
      type: 1,
      frequency: 1,
      interval: 1,
      dayOfWeek: 1,
      dayOfMonth: 1,
      monthOfYear: 1,
      startDate: 1,
      nextDue: 1,
      semanticScore: 1,
      ...(includeRawTransactions ? { rawTx: 1 } : {}),
      ...(rawTransactionsAggregation ? { rawAgg: 1 } : {}),
    },
  });

  const total: Stage[] = [{ $count: 'value' }];
  const aggregates: Stage[] = buildRecurringAggregatesFacet(aggregation, presentation);

  pipeline.push({
    $facet: {
      results,
      total,
      aggregates,
    },
  });

  return pipeline as unknown as Prisma.InputJsonValue[];
}

// ------------------------------------
// Display mapping for recurring hits
// ------------------------------------
function toRecurringDisplayHit(
  doc: any,
  presentation?: PresentationOptions
): RecurringTransactionSearchHitDisplay {
  const locale = presentation?.locale || DEFAULT_LOCALE;
  const timezone = presentation?.timezone || DEFAULT_TIMEZONE;
  const dateStyle = presentation?.dateStyle || DEFAULT_DATE_STYLE;
  const includeTime = presentation?.includeTime || false;
  const currencyCode = presentation?.currencyCode || DEFAULT_CURRENCY;

  const nextDueDate = new Date(doc.nextDue);
  const startDt = new Date(doc.startDate);

  const formattedDate = new Intl.DateTimeFormat(locale, {
    timeZone: timezone,
    dateStyle,
    ...(includeTime ? { timeStyle: 'short' } : {}),
  }).format(nextDueDate);

  const nextDueFormatted = formattedDate;
  const startDateFormatted = new Intl.DateTimeFormat(locale, {
    timeZone: timezone,
    dateStyle,
    ...(includeTime ? { timeStyle: 'short' } : {}),
  }).format(startDt);

  const formattedAmount = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: currencyCode,
  }).format(doc.amount);

  const typeLabel = (doc.type === 'income' ? 'Income' : 'Expense');

  // Children (if present)
  let rawTransactions: TransactionSearchHitDisplay[] | undefined;
  if (Array.isArray(doc.rawTx)) {
    rawTransactions = (doc.rawTx as any[]).map(tx => toDisplayHit(tx, presentation));
  }

  const hit: RecurringTransactionSearchHitDisplay = {
    id: doc._id,
    isRecurring: true,
    display: {
      formattedDate,          // we surface nextDue in the primary date field
      formattedAmount,
      category: doc.category,
      description: doc.description ?? null,
      typeLabel,
    },
    recurring: {
      id: doc._id,
      frequency: doc.frequency,
      interval: doc.interval,
      nextDueFormatted,
      startDateFormatted,
    },
    ...(rawTransactions ? { rawTransactions } : {}),
    ...(Array.isArray(doc.rawAgg) ? { rawTransactionsAggregates: doc.rawAgg as AggregationRow[] } : {}),
  };

  return hit;
}