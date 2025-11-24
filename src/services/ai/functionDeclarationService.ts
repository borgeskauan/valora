import { Transaction, RecurringTransactionInput, TransactionUpdateData, RecurringTransactionUpdateData } from "../../types/models";
import { TransactionService } from "../business/TransactionService";
import { RecurringTransactionService } from "../business/RecurringTransactionService";
import { TransactionType } from "../../config/transactionTypes";
import { FUNCTION_DECLARATIONS } from "./functionDeclarations";
import { FreeformTransactionSearchService } from "../business/search/FreeformTransactionSearchService";

/**
 * Service for executing AI function calls
 * Handles mapping of function declarations to actual service implementations
 */
export class FunctionDeclarationService {
  private readonly transactionService: TransactionService;
  private readonly recurringTransactionService: RecurringTransactionService;
  private readonly searchService: FreeformTransactionSearchService;

  private readonly functionMapping = new Map<string, Function>([
    // Date/Time functions
    [
      "getCurrentDate",
      () => {
        const now = new Date();
        return {
          date: now.toISOString().split('T')[0], // YYYY-MM-DD
          dayOfWeek: now.toLocaleDateString('en-US', { weekday: 'long' }),
          fullDate: now.toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
          }),
          timestamp: now.toISOString()
        };
      }
    ],
    // Transaction function (async) - handles both expense and income
    [
      "addTransaction",
      async (userId: string, params: { transactionData: Transaction }) => {
        console.log("Executing addTransaction with params:", JSON.stringify(params, null, 2));
        return await this.transactionService.addTransaction(userId, params.transactionData);
      }
    ],
    // Recurring transaction function (async) - handles both expense and income
    [
      "createRecurringTransaction",
      async (userId: string, params: { recurringTransactionData: RecurringTransactionInput }) => {
        console.log("Executing createRecurringTransaction with params:", JSON.stringify(params, null, 2));
        return await this.recurringTransactionService.createRecurringTransaction(userId, params.recurringTransactionData);
      }
    ],
    // Edit last transaction (async)
    [
      "editLastTransaction",
      async (userId: string, params: { updates: TransactionUpdateData, transactionType?: TransactionType }) => {
        console.log("Executing editLastTransaction with params:", JSON.stringify(params, null, 2));
        return await this.transactionService.editLastTransaction(userId, params.updates, params.transactionType);
      }
    ],
    // Edit last recurring transaction (async)
    [
      "editLastRecurringTransaction",
      async (userId: string, params: { updates: RecurringTransactionUpdateData, transactionType?: TransactionType }) => {
        console.log("Executing editLastRecurringTransaction with params:", JSON.stringify(params, null, 2));
        return await this.recurringTransactionService.editLastRecurringTransaction(userId, params.updates, params.transactionType);
      }
    ],
    // Edit transaction by ID (async)
    [
      "editTransactionById",
      async (userId: string, params: { id: string, updates: TransactionUpdateData }) => {
        console.log("Executing editTransactionById with params:", JSON.stringify(params, null, 2));
        return await this.transactionService.editTransactionById(userId, params.id, params.updates);
      }
    ],
    // Edit recurring transaction by ID (async)
    [
      "editRecurringTransactionById",
      async (userId: string, params: { id: string, updates: RecurringTransactionUpdateData }) => {
        console.log("Executing editRecurringTransactionById with params:", JSON.stringify(params, null, 2));
        return await this.recurringTransactionService.editRecurringTransactionById(userId, params.id, params.updates);
      }
    ],
    // Delete transactions (async)
    [
      "deleteTransactions",
      async (userId: string, params: { ids: string[] }) => {
        console.log("Executing deleteTransactions with params:", JSON.stringify(params, null, 2));
        return await this.transactionService.deleteTransactions(userId, params.ids);
      }
    ],
    // Disable recurring transactions (async)
    [
      "disableRecurringTransactions",
      async (userId: string, params: { ids: string[] }) => {
        console.log("Executing disableRecurringTransactions with params:", JSON.stringify(params, null, 2));
        return await this.recurringTransactionService.disableRecurringTransactions(userId, params.ids);
      }
    ],
    // Aggregation functions (async)
    [
      "aggregateTransactions",
      async (userId: string, params: { pipeline: any[], textQuery?: string }) => {
        console.log("Executing aggregateTransactions with params:", JSON.stringify(params, null, 2));
        return await this.searchService.aggregateTransactions(userId, {
          pipeline: params.pipeline,
          textQuery: params.textQuery
        });
      }
    ],
    [
      "aggregateRecurringTransactions",
      async (userId: string, params: { pipeline: any[], textQuery?: string }) => {
        console.log("Executing aggregateRecurringTransactions with params:", JSON.stringify(params, null, 2));
        return await this.searchService.aggregateRecurringTransactions(userId, {
          pipeline: params.pipeline,
          textQuery: params.textQuery
        });
      }
    ]
  ]);

  constructor(
    transactionService: TransactionService, 
    recurringTransactionService: RecurringTransactionService,
    searchService: FreeformTransactionSearchService
  ) {
    this.transactionService = transactionService;
    this.recurringTransactionService = recurringTransactionService;
    this.searchService = searchService;
  }

  /**
   * Get all function declarations for AI tools
   */
  getFunctionDeclarations() {
    return FUNCTION_DECLARATIONS;
  }

  /**
   * Execute a function by name with parameters
   * @param functionName - The name of the function to execute
   * @param userId - The user ID for the function execution
   * @param parameters - The parameters for the function
   * @returns The result of the function execution
   * @throws Error if the function is not found
   */
  async executeFunction(functionName: string, userId: string, parameters: any): Promise<any> {
    const func = this.functionMapping.get(functionName);
    if (!func) {
      throw new Error(`Function '${functionName}' not found`);
    }
    const result = await func(userId, parameters);
    console.debug(`[FunctionDeclaration] Function '${functionName}' returned:`, JSON.stringify(result, null, 2));
    return result;
  }
}