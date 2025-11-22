import { TransactionData, TransactionResult, RecurringTransactionData, RecurringTransactionResult } from '../../types/models';
import { success, failure } from '../../types/serviceResult';
import { UserContextProvider } from '../../lib/UserContextProvider';
import { PrismaClient } from '../../generated/prisma';
import { PrismaClientManager } from '../../lib/PrismaClientManager';
import { TransactionType } from '../../config/transactionTypes';
import { ErrorHandler } from '../../lib/ErrorHandler';

/**
 * Service for looking up individual transactions and recurring transactions by ID or filters.
 * Uses Prisma ORM to query SQLite database.
 * 
 * Note: For complex queries with MongoDB filters, use TransactionQueryService from infrastructure layer.
 */
export class TransactionLookupService {
  private prisma: PrismaClient;
  private userContext?: UserContextProvider;

  constructor(userContext?: UserContextProvider) {
    this.prisma = PrismaClientManager.getClient();
    this.userContext = userContext;
  }

  /**
   * Get the last transaction for a user
   * @param userId - The user ID
   * @param type - Optional transaction type filter (expense or income)
   * @returns ServiceResult with the most recent transaction
   */
  async getLastTransactionByUser(userId: string, type?: TransactionType): Promise<TransactionResult> {
    try {
      const whereClause: any = { userId };
      if (type) {
        whereClause.type = type;
      }

      const transaction = await this.prisma.transaction.findFirst({
        where: whereClause,
        orderBy: { createdAt: 'desc' },
      });

      if (!transaction) {
        const typeMessage = type ? ` ${type}` : '';
        return failure(
          `No${typeMessage} transactions found`,
          'NOT_FOUND',
          `You don't have any${typeMessage} transactions yet.`
        );
      }

      return success(
        {
          id: transaction.id,
          amount: transaction.amount,
          category: transaction.category,
          description: transaction.description,
          date: transaction.date,
          type: transaction.type as TransactionType,
        },
        'Transaction found'
      );
    } catch (error) {
      return ErrorHandler.handleDatabaseError(error, 'fetching the last transaction');
    }
  }

  /**
   * Get a specific transaction by ID with ownership validation
   * @param id - Transaction ID
   * @param userId - User ID for ownership validation
   * @returns ServiceResult with transaction data or error
   */
  async getTransactionById(id: string, userId: string): Promise<TransactionResult> {
    try {
      const transaction = await this.prisma.transaction.findFirst({
        where: {
          id,
          userId, // Ownership validation
        },
      });

      if (!transaction) {
        return failure(
          'Transaction not found',
          'NOT_FOUND',
          'The transaction does not exist or you do not have access to it.'
        );
      }

      return success(
        {
          id: transaction.id,
          amount: transaction.amount,
          category: transaction.category,
          description: transaction.description,
          date: transaction.date,
          type: transaction.type as TransactionType,
        },
        'Transaction found'
      );
    } catch (error) {
      return ErrorHandler.handleDatabaseError(error, 'fetching transaction by ID');
    }
  }

  /**
   * Get the last recurring transaction for a user
   * @param userId - The user ID
   * @param type - Optional transaction type filter (expense or income)
   * @returns ServiceResult with the most recent recurring transaction
   */
  async getLastRecurringTransactionByUser(userId: string, type?: TransactionType): Promise<RecurringTransactionResult> {
    try {
      const whereClause: any = { userId, isActive: true };
      if (type) {
        whereClause.type = type;
      }

      const recurringTransaction = await this.prisma.recurringTransaction.findFirst({
        where: whereClause,
        orderBy: { createdAt: 'desc' },
      });

      if (!recurringTransaction) {
        const typeMessage = type ? ` ${type}` : '';
        return failure(
          `No${typeMessage} recurring transactions found`,
          'NOT_FOUND',
          `You don't have any active${typeMessage} recurring transactions yet.`
        );
      }

      return success(
        {
          id: recurringTransaction.id,
          amount: recurringTransaction.amount,
          category: recurringTransaction.category,
          description: recurringTransaction.description,
          frequency: recurringTransaction.frequency,
          interval: recurringTransaction.interval,
          dayOfWeek: recurringTransaction.dayOfWeek,
          dayOfMonth: recurringTransaction.dayOfMonth,
          monthOfYear: recurringTransaction.monthOfYear,
          nextDue: recurringTransaction.nextDue,
          startDate: recurringTransaction.startDate,
          type: recurringTransaction.type as TransactionType,
        },
        'Recurring transaction found'
      );
    } catch (error) {
      return ErrorHandler.handleDatabaseError(error, 'fetching the last recurring transaction');
    }
  }

  /**
   * Get a specific recurring transaction by ID with ownership validation
   * @param id - Recurring transaction ID
   * @param userId - User ID for ownership validation
   * @returns ServiceResult with recurring transaction data or error
   */
  async getRecurringTransactionById(id: string, userId: string): Promise<RecurringTransactionResult> {
    try {
      const recurringTransaction = await this.prisma.recurringTransaction.findFirst({
        where: {
          id,
          userId, // Ownership validation
          isActive: true, // Only allow editing active recurring transactions
        },
      });

      if (!recurringTransaction) {
        return failure(
          'Recurring transaction not found',
          'NOT_FOUND',
          'The recurring transaction does not exist, is inactive, or you do not have access to it.'
        );
      }

      return success(
        {
          id: recurringTransaction.id,
          amount: recurringTransaction.amount,
          category: recurringTransaction.category,
          description: recurringTransaction.description,
          frequency: recurringTransaction.frequency,
          interval: recurringTransaction.interval,
          dayOfWeek: recurringTransaction.dayOfWeek,
          dayOfMonth: recurringTransaction.dayOfMonth,
          monthOfYear: recurringTransaction.monthOfYear,
          nextDue: recurringTransaction.nextDue,
          startDate: recurringTransaction.startDate,
          type: recurringTransaction.type as TransactionType,
        },
        'Recurring transaction found'
      );
    } catch (error) {
      return ErrorHandler.handleDatabaseError(error, 'fetching recurring transaction by ID');
    }
  }
}
