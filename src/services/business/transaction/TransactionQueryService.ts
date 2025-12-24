import { TransactionData } from '../../../types/models';
import { TransactionType } from '../../../config/transactionTypes';
import { TransactionLookupService } from '../TransactionLookupService';
import { ServiceResult } from '../../../types/serviceResult';

/**
 * Service for querying one-time transactions
 * Read-only operations with no side effects
 */
export class TransactionQueryService {
  constructor(
    private lookupService: TransactionLookupService
  ) {}

  /**
   * Find a transaction by ID with ownership validation
   * 
   * @param userId - User ID for ownership validation
   * @param id - Transaction ID
   * @returns ServiceResult with transaction data or error
   */
  async findById(userId: string, id: string): Promise<ServiceResult<TransactionData>> {
    return await this.lookupService.getTransactionById(id, userId);
  }

  /**
   * Find the last transaction for a user with optional type filter
   * 
   * @param userId - User ID
   * @param type - Optional transaction type filter (expense or income)
   * @returns ServiceResult with transaction data or error
   */
  async findLastByUser(userId: string, type?: TransactionType): Promise<ServiceResult<TransactionData>> {
    return await this.lookupService.getLastTransactionByUser(userId, type);
  }
}
