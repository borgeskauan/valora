import { RecurringTransactionData } from '../../../types/models';
import { TransactionType } from '../../../config/transactionTypes';
import { TransactionLookupService } from '../TransactionLookupService';
import { ServiceResult } from '../../../types/serviceResult';

/**
 * Service for querying recurring transactions
 * Read-only operations with no side effects
 */
export class RecurringTransactionQueryService {
  constructor(
    private lookupService: TransactionLookupService
  ) {}

  /**
   * Find a recurring transaction by ID with ownership validation
   * 
   * @param userId - User ID for ownership validation
   * @param id - Recurring transaction ID
   * @returns ServiceResult with recurring transaction data or error
   */
  async findById(userId: string, id: string): Promise<ServiceResult<RecurringTransactionData>> {
    return await this.lookupService.getRecurringTransactionById(id, userId);
  }

  /**
   * Find the last recurring transaction for a user with optional type filter
   * 
   * @param userId - User ID
   * @param type - Optional transaction type filter (expense or income)
   * @returns ServiceResult with recurring transaction data or error
   */
  async findLastByUser(userId: string, type?: TransactionType): Promise<ServiceResult<RecurringTransactionData>> {
    return await this.lookupService.getLastRecurringTransactionByUser(userId, type);
  }
}
