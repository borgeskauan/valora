import { Type } from "@google/genai";
import { FREQUENCIES } from "../../config/frequencies";
import { TRANSACTION_TYPES } from "../../config/transactionTypes";

/**
 * Common property definitions for transactions
 * Reusable across all function declarations
 */
const COMMON_PROPERTIES = {
  amount: {
    type: Type.NUMBER,
    description: "The amount of the transaction, must be positive",
  },
  category: {
    type: Type.STRING,
    description: "The category for the transaction. Choose from the appropriate list based on the type (expense or income).",
  },
  description: {
    type: Type.STRING,
    description: "Optional description of the transaction",
  },
  date: {
    type: Type.STRING,
    description: "The date and optional time in ISO format. If user provides only date, use YYYY-MM-DD format. If user specifies a time (e.g., 'at 8pm', 'at 2:30 PM', 'in the morning'), include it using full ISO-8601 format with UTC timezone (YYYY-MM-DDTHH:mm:ss.sssZ). Examples: '2025-11-10' (date only) or '2025-11-10T20:00:00.000Z' (date with 8pm time in UTC).",
  },
  type: {
    type: Type.STRING,
    description: "The transaction type: 'expense' for money spent or 'income' for money received",
    enum: [...TRANSACTION_TYPES],
  },
};

/**
 * Recurring-specific property definitions
 * Used for recurring transaction declarations
 */
const RECURRING_PROPERTIES = {
  frequency: {
    type: Type.STRING,
    description: "How often the transaction recurs",
    enum: FREQUENCIES,
  },
  interval: {
    type: Type.NUMBER,
    description: "The interval for the frequency (e.g., 2 for 'every 2 weeks'). Must be at least 1.",
  },
  dayOfWeek: {
    type: Type.NUMBER,
    description: "For weekly frequency: Day of the week (0=Sunday, 1=Monday, 2=Tuesday, 3=Wednesday, 4=Thursday, 5=Friday, 6=Saturday)",
  },
  dayOfMonth: {
    type: Type.NUMBER,
    description: "For monthly frequency: Day of the month (1-31)",
  },
  monthOfYear: {
    type: Type.NUMBER,
    description: "For yearly frequency: Month of the year (0=January, 1=February, ..., 11=December)",
  },
  startDate: {
    type: Type.STRING,
    description: "The start date and optional time in ISO format. If user provides only date, use YYYY-MM-DD format. If user specifies a time, include it using full ISO-8601 format with UTC timezone (YYYY-MM-DDTHH:mm:ss.sssZ).",
  },
};

/**
 * Combined properties for recurring transactions (common + recurring-specific)
 */
const RECURRING_TRANSACTION_PROPERTIES = {
  ...COMMON_PROPERTIES,
  ...RECURRING_PROPERTIES,
};

/**
 * Function declaration for getting current date information
 */
export const getCurrentDateDeclaration = {
  name: "getCurrentDate",
  parameters: {
    type: Type.OBJECT,
    description: "Get the current date and time information. Use this when you need to confirm today's date or calculate relative dates like 'yesterday' or 'last week'.",
    properties: {},
  },
};

/**
 * Function declaration for adding a new transaction (expense or income)
 */
export const addTransactionDeclaration = {
  name: "addTransaction",
  parameters: {
    type: Type.OBJECT,
    description: "Add a new transaction (expense or income) for a user. This function returns a structured result with a 'success' field. On success (success=true), it includes a formatted message and transaction details. On failure (success=false), it includes validation errors in the 'error' object with 'validationErrors' array. IMPORTANT: Always check the 'success' field and handle both cases. If validation fails, explain the errors to the user in a friendly way and ask for the missing or corrected information.",
    properties: {
      transactionData: {
        type: Type.OBJECT,
        description: "The transaction data to add",
        properties: COMMON_PROPERTIES,
        required: ["date", "amount", "category", "type"],
      },
    },
    required: ["transactionData"],
  },
};

/**
 * Function declaration for creating a recurring transaction (expense or income)
 */
export const addRecurringTransactionDeclaration = {
  name: "createRecurringTransaction",
  parameters: {
    type: Type.OBJECT,
    description: "Create a new recurring transaction (expense or income) that repeats on a regular schedule (daily, weekly, monthly, or yearly). This function returns a structured result with a 'success' field. On success (success=true), it includes a formatted message and recurring transaction details including when the next transaction is due. On failure (success=false), it includes validation errors in the 'error' object with 'validationErrors' array. IMPORTANT: Always check the 'success' field and handle both cases. If validation fails, explain the errors to the user in a friendly way and ask for the missing or corrected information.",
    properties: {
      recurringTransactionData: {
        type: Type.OBJECT,
        description: "The recurring transaction data to add",
        properties: RECURRING_TRANSACTION_PROPERTIES,
        required: ["amount", "category", "frequency", "type"],
      },
    },
    required: ["recurringTransactionData"],
  },
};

/**
 * Function declaration for editing the most recent transaction
 */
export const editLastTransactionDeclaration = {
  name: "editLastTransaction",
  parameters: {
    type: Type.OBJECT,
    description: "Edit the most recently added transaction (expense or income). Use this when user wants to modify their last transaction - change amount, category, description, date, or type. This function returns a structured result with a 'success' field. On success (success=true), it includes updated transaction details with a message highlighting what changed. On failure (success=false), it includes validation errors. IMPORTANT: Always check the 'success' field. If no transactions exist, inform the user they need to add one first.",
    properties: {
      updates: {
        type: Type.OBJECT,
        description: "Fields to update - only include the fields the user wants to change",
        properties: COMMON_PROPERTIES,
      },
      transactionType: {
        type: Type.STRING,
        description: "Optional filter to specify whether to edit last expense or last income. Use when user explicitly says 'edit last expense' or 'edit last income'. If not specified, edits the most recent transaction of any type.",
        enum: [...TRANSACTION_TYPES],
      },
    },
    required: ["updates"],
  },
};

/**
 * Function declaration for editing the most recent recurring transaction
 */
export const editLastRecurringTransactionDeclaration = {
  name: "editLastRecurringTransaction",
  parameters: {
    type: Type.OBJECT,
    description: "Edit the most recently added recurring transaction (expense or income). Use this when user wants to modify their last recurring/subscription transaction - change amount, category, description, frequency, interval, or type. This function returns a structured result with a 'success' field. On success (success=true), it includes updated recurring transaction details. On failure (success=false), it includes validation errors. IMPORTANT: Always check the 'success' field. If no recurring transactions exist, inform the user they need to create one first.",
    properties: {
      updates: {
        type: Type.OBJECT,
        description: "Fields to update - only include the fields the user wants to change",
        properties: RECURRING_TRANSACTION_PROPERTIES,
      },
      transactionType: {
        type: Type.STRING,
        description: "Optional filter to specify whether to edit last recurring expense or last recurring income. Use when user explicitly says 'edit last recurring expense' or 'edit last recurring income'. If not specified, edits the most recent recurring transaction of any type.",
        enum: [...TRANSACTION_TYPES],
      },
    },
    required: ["updates"],
  },
};

/**
 * Function declaration for editing a specific transaction by ID
 */
export const editTransactionByIdDeclaration = {
  name: "editTransactionById",
  parameters: {
    type: Type.OBJECT,
    description: `Edit a specific transaction by its ID. Returns a structured result with 'success' field. On success, includes updated transaction data and confirmation message. On failure, includes error details.`,
    properties: {
      id: {
        type: Type.STRING,
        description: "The ID of the transaction to edit (obtained from searchTransactions results)",
      },
      updates: {
        type: Type.OBJECT,
        description: "Fields to update in the transaction - only include the fields the user wants to change",
        properties: COMMON_PROPERTIES,
      },
    },
    required: ["id", "updates"],
  },
};

/**
 * Function declaration for editing a specific recurring transaction by ID
 */
export const editRecurringTransactionByIdDeclaration = {
  name: "editRecurringTransactionById",
  parameters: {
    type: Type.OBJECT,
    description: `Edit a specific recurring transaction by its ID. Returns a structured result with 'success' field. On success, includes updated recurring transaction data (with recalculated nextDue if frequency changed) and confirmation message. On failure, includes error details.`,
    properties: {
      id: {
        type: Type.STRING,
        description: "The ID of the recurring transaction to edit (obtained from searchTransactions results on RecurringTransaction table)",
      },
      updates: {
        type: Type.OBJECT,
        description: "Fields to update in the recurring transaction - only include the fields the user wants to change",
        properties: RECURRING_TRANSACTION_PROPERTIES,
      },
    },
    required: ["id", "updates"],
  },
};

/**
 * Function declaration for deleting one-time transactions
 */
export const deleteTransactionsDeclaration = {
  name: "deleteTransactions",
  parameters: {
    type: Type.OBJECT,
    description: `Delete one or multiple one-time transactions by their IDs. Permanently removes transactions (cannot be undone). Returns a structured result with 'success' field. On success, includes deletedCount and confirmation message. On failure, includes error details. All-or-nothing operation.`,
    properties: {
      ids: {
        type: Type.ARRAY,
        description: "Array of transaction IDs to delete (obtained from searchTransactions results on Transaction table). Can be single ID [123] or multiple [123, 456, 789]",
        items: {
          type: Type.STRING,
          description: "Transaction ID"
        }
      }
    },
    required: ["ids"]
  }
};

/**
 * Function declaration for deleting (deactivating) recurring transactions
 */
export const deleteRecurringTransactionsDeclaration = {
  name: "deleteRecurringTransactions",
  parameters: {
    type: Type.OBJECT,
    description: `Delete (deactivate) one or multiple recurring transactions by their IDs. Deactivates recurring transactions (soft delete) - stops future occurrences but preserves history. Returns a structured result with 'success' field. On success, includes deactivatedCount and confirmation message. On failure, includes error details. All-or-nothing operation.`,
    properties: {
      ids: {
        type: Type.ARRAY,
        description: "Array of recurring transaction IDs to delete (obtained from searchTransactions results on RecurringTransaction table). Can be single ID [12] or multiple [12, 34, 56]",
        items: {
          type: Type.STRING,
          description: "Recurring transaction ID"
        }
      }
    },
    required: ["ids"]
  }
};

export const aggregateTransactionsDeclaration = {
  name: "aggregateTransactions",
  parameters: {
    type: Type.OBJECT,
    description: `Execute a MongoDB aggregation pipeline on the Transaction collection. 

CRITICAL: This function is used for ALL transaction queries - not just analytics. Use it for:
- Finding transactions to edit/delete (MUST include _id in $project or select all fields)
- Generating reports and analytics ($group, calculations, etc.)
- Filtering by date ranges, categories, amounts, etc.
- Sorting and limiting results

You have FULL CONTROL over the pipeline. The service will automatically:
1. Prepend { $match: { userId } } for security (you don't add this)
2. Enforce sane limits (clamp to 1000 max, add 100 default if missing)

Common pipeline patterns:

1. FIND TRANSACTIONS TO EDIT/DELETE:
[
  { $match: { category: "Food & Dining", date: { $gte: "2025-01-01" } } },
  { $sort: { date: -1 } },
  { $limit: 10 }
]
Result includes full documents with _id field for subsequent operations.

2. ANALYTICS - Monthly spending by category:
[
  { $match: { date: { $gte: "2025-01-01", $lte: "2025-12-31" } } },
  { $addFields: { month: { $substr: ["$date", 0, 7] } } },
  { $group: { _id: { month: "$month", category: "$category" }, total: { $sum: "$amount" } } },
  { $sort: { "_id.month": 1, total: -1 } }
]

3. TOP EXPENSES:
[
  { $match: { type: "expense" } },
  { $sort: { amount: -1 } },
  { $limit: 5 },
  { $project: { date: 1, description: 1, category: 1, amount: 1 } }
]

MongoDB Aggregation Operators:
- Filtering: $match (queries), $limit, $skip
- Grouping: $group with $sum, $avg, $min, $max, $count
- Sorting: $sort (1 for ascending, -1 for descending)
- Projecting: $project (select fields), $addFields (computed fields)
- Date operations: $year, $month, $dayOfMonth, $substr for date strings
- Conditionals: $cond, $switch for logic
- String operations: $concat, $substr, $toLower, $toUpper

Returns structured result with 'success' field. On success, data is array of documents matching your pipeline output. On failure, includes error details.`,
    properties: {
      pipeline: {
        type: Type.ARRAY,
        description: "MongoDB aggregation pipeline stages (array of objects). Do NOT include { $match: { userId } } - it's added automatically. Each stage is an object with one operator key (e.g., { $match: {...} }, { $group: {...} }).",
        items: {
          type: Type.OBJECT,
          description: "Aggregation stage object"
        }
      },
      textQuery: {
        type: Type.STRING,
        description: "Optional semantic search query to pre-filter transactions before aggregation. Example: 'coffee purchases', 'uber rides'. The service will find semantically similar transactions and add their IDs to the pipeline automatically."
      }
    },
    required: ["pipeline"]
  }
};

export const aggregateRecurringTransactionsDeclaration = {
  name: "aggregateRecurringTransactions",
  parameters: {
    type: Type.OBJECT,
    description: `Execute a MongoDB aggregation pipeline on the RecurringTransaction collection.

CRITICAL: This function is used for ALL recurring transaction queries. Use it for:
- Finding recurring transactions to edit/delete (MUST include _id in results)
- Analyzing subscription costs and patterns
- Finding upcoming bills (filter by nextDue date)
- Calculating total recurring expenses/income

You have FULL CONTROL over the pipeline. The service will automatically:
1. Prepend { $match: { userId } } for security
2. Enforce sane limits (clamp to 1000 max, add 100 default if missing)

Common patterns:

1. FIND RECURRING TRANSACTIONS TO EDIT/DELETE:
[
  { $match: { frequency: "monthly", isActive: true } },
  { $sort: { nextDue: 1 } },
  { $limit: 10 }
]

2. UPCOMING BILLS (next 30 days):
[
  { $match: { 
      isActive: true, 
      nextDue: { $gte: "2025-11-23", $lte: "2025-12-23" } 
    } },
  { $sort: { nextDue: 1 } }
]

3. TOTAL MONTHLY RECURRING COSTS:
[
  { $match: { isActive: true, type: "expense" } },
  { $group: { 
      _id: "$frequency", 
      count: { $sum: 1 }, 
      total: { $sum: "$amount" } 
    } }
]

RecurringTransaction fields:
- frequency: "daily" | "weekly" | "monthly" | "yearly"
- interval: number (e.g., 2 for every 2 weeks)
- nextDue: ISO date string of next occurrence
- isActive: boolean (false = deactivated/cancelled)
- amount, category, description, type (expense/income)
- dayOfWeek, dayOfMonth, monthOfYear (pattern fields)

Returns structured result with 'success' field. On success, data is array of documents. On failure, includes error details.`,
    properties: {
      pipeline: {
        type: Type.ARRAY,
        description: "MongoDB aggregation pipeline stages. Do NOT include { $match: { userId } } - it's added automatically.",
        items: {
          type: Type.OBJECT,
          description: "Aggregation stage object"
        }
      },
      textQuery: {
        type: Type.STRING,
        description: "Optional semantic search query. Example: 'streaming services', 'music subscription'."
      }
    },
    required: ["pipeline"]
  }
};

/**
 * Array of all function declarations for Gemini AI
 */
export const FUNCTION_DECLARATIONS = [
  getCurrentDateDeclaration,
  addTransactionDeclaration,
  addRecurringTransactionDeclaration,
  editLastTransactionDeclaration,
  editLastRecurringTransactionDeclaration,
  editTransactionByIdDeclaration,
  editRecurringTransactionByIdDeclaration,
  deleteTransactionsDeclaration,
  deleteRecurringTransactionsDeclaration,
  aggregateTransactionsDeclaration,
  aggregateRecurringTransactionsDeclaration
];
