import { RecurringTransactionData } from '../../../types/models';
import { TransactionEmbeddingService } from '../../ai/embedding/TransactionEmbeddingService';
import { TransactionType } from '../../../config/transactionTypes';

/**
 * Service for synchronizing recurring transaction embeddings with vector database
 * Handles embedding operations without failing parent transactions
 */
export class RecurringTransactionSyncService {
  constructor(
    private embeddingService: TransactionEmbeddingService
  ) {}

  /**
   * Embed a newly created recurring transaction
   * Logs warnings on failure but doesn't throw errors
   * 
   * @param transaction - Recurring transaction data to embed
   * @param userId - User ID for the transaction
   */
  async syncEmbedding(transaction: RecurringTransactionData, userId: string): Promise<void> {
    const embeddingResult = await this.embeddingService.embedTransaction({
      id: transaction.id,
      description: transaction.description,
      type: transaction.type as TransactionType,
      kind: 'recurring',
      amount: transaction.amount,
      category: transaction.category,
      date: transaction.nextDue,
      userId: userId,
    });

    if (!embeddingResult.success) {
      console.error(
        `[RecurringTransactionSyncService] Failed to embed recurring transaction ${transaction.id}: ${embeddingResult.message}`
      );
      // Continue - semantic search unavailable but recurring transaction saved
    }
  }

  /**
   * Update embedding for a modified recurring transaction
   * Logs warnings on failure but doesn't throw errors
   * 
   * @param id - Recurring transaction ID
   * @param updates - Updated recurring transaction data
   * @param userId - User ID for the transaction
   */
  async updateEmbedding(id: string, updates: Partial<RecurringTransactionData>, userId: string): Promise<void> {
    const embeddingResult = await this.embeddingService.updateTransactionEmbedding({
      id,
      description: updates.description ?? null,
      type: updates.type as TransactionType,
      kind: 'recurring',
      amount: updates.amount!,
      category: updates.category!,
      date: updates.nextDue!,
      userId: userId,
    });

    if (!embeddingResult.success) {
      console.error(
        `[RecurringTransactionSyncService] Failed to update recurring transaction embedding ${id}: ${embeddingResult.message}`
      );
      // Continue - semantic search unavailable but recurring transaction updated
    }
  }
}
