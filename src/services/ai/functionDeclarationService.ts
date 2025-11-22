import { Transaction, RecurringTransactionInput, TransactionUpdateData, RecurringTransactionUpdateData } from "../../types/models";
import { TransactionService } from "../business/transactionService";
import { RecurringTransactionService } from "../business/recurringTransactionService";
import { TransactionType } from "../../config/transactionTypes";
import { FUNCTION_DECLARATIONS } from "./functionDeclarations";
import { AiSearchService } from "./search/AiSearchService";

/**
 * Service for executing AI function calls
 * Handles mapping of function declarations to actual service implementations
 */
export class FunctionDeclarationService {
  private readonly transactionService: TransactionService;
  private readonly recurringTransactionService: RecurringTransactionService;
  private readonly searchService: AiSearchService;

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
      async (params: { transactionData: Transaction }) => {
        console.log("Executing addTransaction with params:", params);
        return await this.transactionService.addTransaction(params.transactionData);
      }
    ],
    // Recurring transaction function (async) - handles both expense and income
    [
      "createRecurringTransaction",
      async (params: { recurringTransactionData: RecurringTransactionInput }) => {
        console.log("Executing createRecurringTransaction with params:", params);
        return await this.recurringTransactionService.createRecurringTransaction(params.recurringTransactionData);
      }
    ],
    // Edit last transaction (async)
    [
      "editLastTransaction",
      async (params: { updates: TransactionUpdateData, transactionType?: TransactionType }) => {
        console.log("Executing editLastTransaction with params:", params);
        return await this.transactionService.editLastTransaction(params.updates, params.transactionType);
      }
    ],
    // Edit last recurring transaction (async)
    [
      "editLastRecurringTransaction",
      async (params: { updates: RecurringTransactionUpdateData, transactionType?: TransactionType }) => {
        console.log("Executing editLastRecurringTransaction with params:", params);
        return await this.recurringTransactionService.editLastRecurringTransaction(params.updates, params.transactionType);
      }
    ],
    // Edit transaction by ID (async)
    [
      "editTransactionById",
      async (params: { id: string, updates: TransactionUpdateData }) => {
        console.log("Executing editTransactionById with params:", params);
        return await this.transactionService.editTransactionById(params.id, params.updates);
      }
    ],
    // Edit recurring transaction by ID (async)
    [
      "editRecurringTransactionById",
      async (params: { id: string, updates: RecurringTransactionUpdateData }) => {
        console.log("Executing editRecurringTransactionById with params:", params);
        return await this.recurringTransactionService.editRecurringTransactionById(params.id, params.updates);
      }
    ],
    // Delete transactions (async)
    [
      "deleteTransactions",
      async (params: { ids: string[] }) => {
        console.log("Executing deleteTransactions with params:", params);
        return await this.transactionService.deleteTransactions(params.ids);
      }
    ],
    // Delete recurring transactions (async)
    [
      "deleteRecurringTransactions",
      async (params: { ids: string[] }) => {
        console.log("Executing deleteRecurringTransactions with params:", params);
        return await this.recurringTransactionService.deleteRecurringTransactions(params.ids);
      }
    ],
    // Search transactions (async)
    [
      "searchTransactions",
      async (params: { query: string, limit?: number }) => {
        console.log("Executing searchTransactions with params:", params);
        return await this.searchService.queryTransactions({
          textQuery: params.query,
          limit: params.limit || 10
        });
      }
    ],
    // Search recurring transactions (async)
    [
      "searchRecurringTransactions",
      async (params: { query: string, limit?: number }) => {
        console.log("Executing searchRecurringTransactions with params:", params);
        return await this.searchService.queryRecurringTransactions({
          textQuery: params.query,
          limit: params.limit || 10
        });
      }
    ]
  ]);

  constructor(
    transactionService: TransactionService, 
    recurringTransactionService: RecurringTransactionService,
    searchService: AiSearchService
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
   * @param parameters - The parameters for the function
   * @returns The result of the function execution
   * @throws Error if the function is not found
   */
  async executeFunction(functionName: string, parameters: any): Promise<any> {
    const func = this.functionMapping.get(functionName);
    if (!func) {
      throw new Error(`Function '${functionName}' not found`);
    }
    const result = await func(parameters);
    console.debug(`[FunctionDeclaration] Function '${functionName}' returned:`, JSON.stringify(result, null, 2));
    return result;
  }
}