import { ServiceResult, success, failure } from '../../../types/serviceResult';
import {
  TransactionEmbeddingInput,
  TransactionEmbeddingMetadata,
  TransactionSearchResult,
  EmbeddingOperationResult,
} from '../../../types/embedding';
import { TransactionType } from '../../../config/transactionTypes';
import { PrismaClient } from '../../../generated/prisma';
import { PrismaClientManager } from '../../../lib/PrismaClientManager';
import { config } from '../../../config/config';
import embeddingStore from './embeddingStore';

export class TransactionEmbeddingService {
  private prisma: PrismaClient;
  private threshold: number;

  constructor() {
    this.prisma = PrismaClientManager.getClient();
    this.threshold = config.embeddingThreshold;
  }

  /**
   * Embed a transaction in the vector store
   */
  async embedTransaction(
    input: TransactionEmbeddingInput
  ): Promise<ServiceResult<EmbeddingOperationResult>> {
    try {
      const prefixedId = this.buildPrefixedId(input.id, input.kind);
      const description = this.generateDescription(input);
      const metadata = this.buildMetadata(prefixedId, input.type, input.kind, input.userId);

      console.log(`[TransactionEmbedding] Embedding ${input.kind} transaction ${prefixedId} for user ${input.userId}`);
      console.log(`[TransactionEmbedding] Description: "${description.substring(0, 50)}${description.length > 50 ? '...' : ''}"}`);

      const qdrantId = await embeddingStore.save(
        description,
        metadata as unknown as Record<string, unknown>
      );

      console.log(`[TransactionEmbedding] Successfully embedded ${prefixedId} with Qdrant ID: ${qdrantId}`);

      return success(
        { qdrantId, transactionId: prefixedId },
        'Transaction embedded successfully'
      );
    } catch (error) {
      console.error(`[TransactionEmbedding] Failed to embed transaction ${input.id}:`, error);
      return failure(
        'Failed to embed transaction',
        'EMBEDDING_ERROR',
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  /**
   * Update an existing transaction embedding
   */
  async updateTransactionEmbedding(
    input: TransactionEmbeddingInput
  ): Promise<ServiceResult<EmbeddingOperationResult>> {
    try {
      const prefixedId = this.buildPrefixedId(input.id, input.kind);
      const description = this.generateDescription(input);
      const metadata = this.buildMetadata(prefixedId, input.type, input.kind, input.userId);

      console.log(`[TransactionEmbedding] Updating ${input.kind} transaction ${prefixedId} for user ${input.userId}`);
      console.log(`[TransactionEmbedding] New description: "${description.substring(0, 50)}${description.length > 50 ? '...' : ''}"}`);

      const qdrantId = await embeddingStore.update(
        prefixedId,
        description,
        metadata as unknown as Record<string, unknown>
      );

      console.log(`[TransactionEmbedding] Successfully updated ${prefixedId} with Qdrant ID: ${qdrantId}`);

      return success(
        { qdrantId, transactionId: prefixedId },
        'Transaction embedding updated successfully'
      );
    } catch (error) {
      console.error(`[TransactionEmbedding] Failed to update transaction ${input.id}:`, error);
      return failure(
        'Failed to update transaction embedding',
        'EMBEDDING_UPDATE_ERROR',
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  /**
   * Search transactions by natural language description
   */
  async searchTransactionsByDescription(
    userId: string,
    query: string,
    k = 20
  ): Promise<ServiceResult<TransactionSearchResult[]>> {
    console.log(`[TransactionEmbedding] Searching transactions for user ${userId} with query: "${query}" (threshold=${this.threshold})`);

    try {
      const hits = await embeddingStore.query(query, k);
      console.log(`[TransactionEmbedding] Vector search returned ${hits.length} hits from Qdrant`);

      // Filter by threshold
      const filteredHits = hits.filter(hit => (hit.score ?? 0) >= this.threshold);
      console.log(`[TransactionEmbedding] ${filteredHits.length} results above threshold ${this.threshold}`);

      const { onetimeIds, recurringIds, scoreMap } = this.parseEmbeddingHits(filteredHits);
      console.log(`[TransactionEmbedding] Parsed ${onetimeIds.length} one-time and ${recurringIds.length} recurring transaction IDs`);

      const transactions = await this.fetchTransactionsByIds(onetimeIds, recurringIds, userId);
      const results = this.buildSearchResults(transactions, scoreMap);

      console.log(`[TransactionEmbedding] Search completed: ${results.length} transactions matched for user ${userId}`);

      console.log(`[TransactionEmbedding] Results: ${JSON.stringify(results, null, 2)}`);

      return success(
        results,
        `Found ${results.length} matching transactions`
      );
    } catch (error) {
      console.error(`[TransactionEmbedding] Search failed for user ${userId}:`, error);
      return failure(
        'Failed to search transactions',
        'SEARCH_ERROR',
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  /**
   * Parse embedding hits and extract transaction IDs grouped by kind
   */
  private parseEmbeddingHits(hits: any[]) {
    const onetimeIds: string[] = [];
    const recurringIds: string[] = [];
    const scoreMap = new Map<string, number>();

    for (const hit of hits) {
      const metadata = hit.payload?.metadata as TransactionEmbeddingMetadata;
      if (!metadata || !metadata.transactionId) continue;

      scoreMap.set(metadata.transactionId, hit.score ?? 0);

      if (metadata.transactionId.startsWith('T-')) {
        const id = metadata.transactionId.substring(2);
        if (id) onetimeIds.push(id);
      } else if (metadata.transactionId.startsWith('RT-')) {
        const id = metadata.transactionId.substring(3);
        if (id) recurringIds.push(id);
      }
    }

    return { onetimeIds, recurringIds, scoreMap };
  }

  /**
   * Fetch transactions from database by IDs
   */
  private async fetchTransactionsByIds(onetimeIds: string[], recurringIds: string[], userId: string) {
    console.log(`[TransactionEmbedding] Fetching transactions from DB for user ${userId}: ${onetimeIds.length} one-time, ${recurringIds.length} recurring`);
    console.log(`[TransactionEmbedding] One-time IDs: ${onetimeIds.join(', ')}`);
    console.log(`[TransactionEmbedding] Recurring IDs: ${recurringIds.join(', ')}`);

    const r = await this.prisma.recurringTransaction.findMany();
    console.log(`[TransactionEmbedding] Total recurring transactions in DB: ${r.length}`);

    const [onetimeTransactions, recurringTransactions] = await Promise.all([
      onetimeIds.length > 0
        ? this.prisma.transaction.findMany({ 
            where: { 
              id: { in: onetimeIds },
              userId: userId
            } 
          })
        : Promise.resolve([]),
      recurringIds.length > 0
        ? this.prisma.recurringTransaction.findMany({ 
            where: { 
              id: { in: recurringIds },
              userId: userId
            } 
          })
        : Promise.resolve([]),
    ]);

    console.log(`[TransactionEmbedding] Fetched ${onetimeTransactions.length} one-time and ${recurringTransactions.length} recurring transactions`);

    return { onetimeTransactions, recurringTransactions };
  }

  /**
   * Build search results from fetched transactions and scores
   */
  private buildSearchResults(
    transactions: { onetimeTransactions: any[]; recurringTransactions: any[] },
    scoreMap: Map<string, number>
  ): TransactionSearchResult[] {
    const results: TransactionSearchResult[] = [];

    // Map onetime transactions
    for (const tx of transactions.onetimeTransactions) {
      const prefixedId = `T-${tx.id}`;
      results.push({
        transaction: {
          id: tx.id,
          amount: tx.amount,
          category: tx.category,
          description: tx.description,
          date: tx.date,
          type: tx.type as TransactionType,
        },
        score: scoreMap.get(prefixedId) ?? 0,
        kind: 'onetime',
      });
    }

    // Map recurring transactions
    for (const tx of transactions.recurringTransactions) {
      const prefixedId = `RT-${tx.id}`;
      results.push({
        transaction: {
          id: tx.id,
          amount: tx.amount,
          category: tx.category,
          description: tx.description,
          date: tx.startDate,
          type: tx.type as TransactionType,
        },
        score: scoreMap.get(prefixedId) ?? 0,
        kind: 'recurring',
      });
    }

    // Sort by score descending
    results.sort((a, b) => b.score - a.score);

    return results;
  }

  /**
   * Build prefixed transaction ID
   */
  private buildPrefixedId(id: string, kind: string): string {
    return kind === 'recurring' ? `RT-${id}` : `T-${id}`;
  }

  /**
   * Generate description from transaction data
   * If description exists, use it; otherwise generate synthetic description
   */
  private generateDescription(input: TransactionEmbeddingInput): string {
    if (input.description) {
      return input.description;
    }

    // Generate synthetic description
    const amount = `$${input.amount.toFixed(2)}`;
    const type = input.type;
    const category = input.category;
    const date = new Date(input.date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });

    return `${amount} ${type} in ${category} on ${date}`;
  }

  /**
   * Build metadata payload for Qdrant
   */
  private buildMetadata(
    transactionId: string,
    type: TransactionType,
    kind: string,
    userId: string
  ): TransactionEmbeddingMetadata {
    return {
      transactionId,
      transactionKind: kind as 'onetime' | 'recurring',
      transactionType: type,
      userId,
    };
  }
}
