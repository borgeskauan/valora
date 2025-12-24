import { Type } from "@google/genai";
import { FREQUENCIES } from "../../config/frequencies";
import { TRANSACTION_TYPES } from "../../config/transactionTypes";

const COMMON_PROPERTIES = {
  amount: {
    type: Type.NUMBER,
    description: "The amount of the transaction, must be positive",
  },
  description: {
    type: Type.STRING,
    description: "Optional description of the transaction",
  },
  date: {
    type: Type.STRING,
    description:
      "Raw date/time phrase as provided by the user (e.g., 'today', 'yesterday', '2025-11-10', 'Nov 10 at 8pm', 'last Friday'). Pass the user's exact wording. The backend will parse and validate it. If not provided, defaults to current date/time.",
  },
  type: {
    type: Type.STRING,
    description: "The transaction type: 'expense' for money spent or 'income' for money received",
    enum: [...TRANSACTION_TYPES],
  },
};

// Common for recurring should NOT include `date`
const COMMON_RECURRING_PROPERTIES = {
  amount: COMMON_PROPERTIES.amount,
  description: COMMON_PROPERTIES.description,
  type: COMMON_PROPERTIES.type,
};

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
    description:
      "For weekly frequency: Day of the week (0=Sunday, 1=Monday, 2=Tuesday, 3=Wednesday, 4=Thursday, 5=Friday, 6=Saturday)",
  },
  dayOfMonth: {
    type: Type.NUMBER,
    description: "For monthly frequency: Day of the month (1-31)",
  },
  monthOfYear: {
    type: Type.NUMBER,
    description: "For yearly frequency: Month of the year (0=January, 1=February, ..., 11=December)",
  },
};

const RECURRING_TRANSACTION_PROPERTIES = {
  ...COMMON_RECURRING_PROPERTIES,
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
    description: "Add a new transaction (expense or income) for a user.",
    properties: {
      transactionData: {
        type: Type.OBJECT,
        description: "The transaction data to add",
        properties: COMMON_PROPERTIES,
        required: ["amount", "type"],
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
    description: "Create a new recurring transaction (expense or income) that repeats on a regular schedule (daily, weekly, monthly, or yearly).",
    properties: {
      recurringTransactionData: {
        type: Type.OBJECT,
        description: "The recurring transaction data to add",
        properties: RECURRING_TRANSACTION_PROPERTIES,
        required: ["amount", "frequency", "type"],
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
    description: "Edit the most recently added transaction (expense or income). Use this when user wants to modify their last transaction - change amount, description, date, or type. If no transactions exist, inform the user they need to add one first.",
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
    description: "Edit the most recently added recurring transaction (expense or income). Use this when user wants to modify their last recurring/subscription transaction - change amount, description, frequency, interval, or type. If no recurring transactions exist, inform the user they need to create one first.",
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

export const editTransactionByIdDeclaration = {
  name: "editTransactionById",
  parameters: {
    type: Type.OBJECT,
    description: `Edit a specific transaction by its ID.`,
    properties: {
      id: {
        type: Type.STRING,
        description: "The ID of the transaction to edit (obtained from aggregateTransactions results).",
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

export const editRecurringTransactionByIdDeclaration = {
  name: "editRecurringTransactionById",
  parameters: {
    type: Type.OBJECT,
    description: `Edit a specific recurring transaction by its ID.`,
    properties: {
      id: {
        type: Type.STRING,
        description: "The ID of the recurring transaction to edit (obtained from aggregateRecurringTransactions results).",
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

export const deleteTransactionsDeclaration = {
  name: "deleteTransactions",
  parameters: {
    type: Type.OBJECT,
    description: `Delete one or multiple one-time transactions by their IDs. Uses implicit two-step confirmation.`,
    properties: {
      ids: {
        type: Type.ARRAY,
        description: "Array of transaction IDs to delete (obtained from aggregateTransactions results). Can be single ID ['123'] or multiple ['123', '456', '789'].",
        items: {
          type: Type.STRING,
          description: "Transaction ID",
        },
      },
    },
    required: ["ids"],
  },
};

export const disableRecurringTransactionsDeclaration = {
  name: "disableRecurringTransactions",
  parameters: {
    type: Type.OBJECT,
    description: `Disable (deactivate) one or multiple recurring transactions by their IDs. Uses implicit two-step confirmation.`,
    properties: {
      ids: {
        type: Type.ARRAY,
        description: "Array of recurring transaction IDs to disable (obtained from aggregateRecurringTransactions results). Can be single ID ['12'] or multiple ['12', '34', '56'].",
        items: {
          type: Type.STRING,
          description: "Recurring transaction ID",
        },
      },
    },
    required: ["ids"],
  },
};

export const aggregateTransactionsDeclaration = {
  name: "aggregateTransactions",
  parameters: {
    type: Type.OBJECT,
    description: "Execute a MongoDB aggregation pipeline on the Transaction collection. Use for ALL queries: finding transactions to edit/delete, generating reports, analytics, filtering, sorting. You control the entire pipeline.",
    properties: {
      pipeline: {
        type: Type.ARRAY,
        description: "MongoDB aggregation pipeline stages (array of objects). Each stage is an object with one operator key.",
        items: {
          type: Type.OBJECT,
          description: "Aggregation stage object"
        }
      },
      textQuery: {
        type: Type.STRING,
        description: "Optional semantic search query to pre-filter transactions before aggregation (e.g., 'coffee purchases', 'uber rides')."
      }
    },
    required: ["pipeline"]
  }
};

export const aggregateRecurringTransactionsDeclaration = {
  name: "aggregateRecurringTransactions",
  parameters: {
    type: Type.OBJECT,
    description: "Execute a MongoDB aggregation pipeline on the RecurringTransaction collection. Use for ALL recurring transaction queries: finding to edit/delete, analyzing subscriptions, upcoming bills, calculating totals.",
    properties: {
      pipeline: {
        type: Type.ARRAY,
        description: "MongoDB aggregation pipeline stages (array of objects).",
        items: {
          type: Type.OBJECT,
          description: "Aggregation stage object"
        }
      },
      textQuery: {
        type: Type.STRING,
        description: "Optional semantic search query (e.g., 'streaming services', 'music subscription')."
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
  disableRecurringTransactionsDeclaration,
  aggregateTransactionsDeclaration,
  aggregateRecurringTransactionsDeclaration
];
