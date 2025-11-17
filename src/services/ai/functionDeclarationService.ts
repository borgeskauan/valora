import { Transaction, RecurringTransactionInput, TransactionUpdateData, RecurringTransactionUpdateData } from "../../types/models";
import { TransactionService } from "../business/transactionService";
import { RecurringTransactionService } from "../business/recurringTransactionService";
import { QueryExecutorService } from "../business/queryExecutorService";
import { TransactionEmbeddingService } from "./embedding/transactionEmbeddingService";
import { TransactionType } from "../../config/transactionTypes";
import { FUNCTION_DECLARATIONS } from "./functionDeclarations";

/**
 * Service for executing AI function calls
 * Handles mapping of function declarations to actual service implementations
 */
export class FunctionDeclarationService {
  private readonly transactionService: TransactionService;
  private readonly recurringTransactionService: RecurringTransactionService;
  private readonly queryExecutorService: QueryExecutorService;
  private readonly embeddingService: TransactionEmbeddingService;

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
    // Query transactions for reports, editing, or deleting (async)
    [
      "queryTransactions",
      async (params: { queryDescription: string, sqlQuery: string }) => {
        console.log("Executing queryTransactions with params:", params);
        return await this.queryExecutorService.executeQuery(
          params.sqlQuery,
          params.queryDescription
        );
      }
    ],
    // Search transactions by semantic description (async)
    [
      "searchTransactionsByDescription",
      async (params: { query: string }) => {
        console.log("Executing searchTransactionsByDescription with params:", params);
        return await this.embeddingService.searchTransactionsByDescription(
          params.query
        );
      }
    ],
  ]);

  constructor(
    transactionService: TransactionService, 
    recurringTransactionService: RecurringTransactionService,
    queryExecutorService: QueryExecutorService,
    embeddingService: TransactionEmbeddingService
  ) {
    this.transactionService = transactionService;
    this.recurringTransactionService = recurringTransactionService;
    this.queryExecutorService = queryExecutorService;
    this.embeddingService = embeddingService;
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