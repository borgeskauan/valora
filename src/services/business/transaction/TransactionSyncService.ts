import { TransactionData } from '../../../types/models';
import { TransactionEmbeddingService } from '../../ai/embedding/TransactionEmbeddingService';
import { TransactionType } from '../../../config/transactionTypes';

/**
 * Service for synchronizing transaction embeddings with vector database
 * Handles embedding operations without failing parent transactions
 */
export class TransactionSyncService {
  constructor(
    private embeddingService: TransactionEmbeddingService
  ) {}

  /**
   * Embed a newly created transaction
   * Logs warnings on failure but doesn't throw errors
   * 
   * @param transaction - Transaction data to embed
   * @param userId - User ID for the transaction
   */
  async syncEmbedding(transaction: TransactionData, userId: string): Promise<void> {
    const embeddingResult = await this.embeddingService.embedTransaction({
      id: transaction.id,
      description: transaction.description,
      type: transaction.type as TransactionType,
      kind: 'onetime',
      amount: transaction.amount,
      category: transaction.category,
      date: transaction.date,
      userId: userId,
    });

    if (!embeddingResult.success) {
      console.error(
        `[TransactionSyncService] Failed to embed transaction ${transaction.id}: ${embeddingResult.message}`
      );
      // Continue - semantic search unavailable but transaction saved
    }
  }

  /**
   * Update embedding for a modified transaction
   * Logs warnings on failure but doesn't throw errors
   * 
   * @param id - Transaction ID
   * @param updates - Updated transaction data
   * @param userId - User ID for the transaction
   */
  async updateEmbedding(id: string, updates: Partial<TransactionData>, userId: string): Promise<void> {
    const embeddingResult = await this.embeddingService.updateTransactionEmbedding({
      id,
      description: updates.description ?? null,
      type: updates.type as TransactionType,
      kind: 'onetime',
      amount: updates.amount!,
      category: updates.category!,
      date: updates.date!,
      userId: userId,
    });

    if (!embeddingResult.success) {
      console.error(
        `[TransactionSyncService] Failed to update transaction embedding ${id}: ${embeddingResult.message}`
      );
      // Continue - semantic search unavailable but transaction updated
    }
  }

  /**
   * Delete embedding for a deleted transaction
   * Currently not implemented as TransactionEmbeddingService doesn't support deletion
   * Embeddings will remain but won't affect functionality since transactions are hard-deleted
   * 
   * @param transactionId - Transaction ID to delete embedding for
   */
  async deleteEmbedding(transactionId: string): Promise<void> {
    // TODO: Implement deleteEmbedding in TransactionEmbeddingService
    // For now, embeddings remain in vector DB (not critical - transactions are deleted from Prisma)
    console.log(`[TransactionSyncService] Skipping embedding deletion for ${transactionId} (not implemented)`);
  }
}
