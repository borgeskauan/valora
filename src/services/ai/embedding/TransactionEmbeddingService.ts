import { ServiceResult, success, failure } from '../../../types/serviceResult';
import {
  TransactionEmbeddingInput,
  TransactionSearchMatch,
  EmbeddingOperationResult,
} from '../../../types/embedding';
import { config } from '../../../config/config';
import { Embedder } from './Embedder';
import { QdrantService, Payload } from './QdrantService';
import { TransactionEmbeddingHelpers } from '../../../lib/TransactionEmbeddingHelpers';
import { v4 as uuidv4 } from 'uuid';

export class TransactionEmbeddingService {
  private readonly TRANSACTIONS_COLLECTION = "transactions";
  private readonly RECURRING_TRANSACTIONS_COLLECTION = "recurring_transactions";
  
  private embedder: Embedder;
  private qdrant: QdrantService;
  private threshold: number;

  constructor(embedder?: Embedder, qdrant?: QdrantService) {
    this.embedder = embedder ?? new Embedder();
    this.qdrant = qdrant ?? new QdrantService();
    this.threshold = config.embeddingThreshold;
  }

  /**
   * Initialize both collections with proper indexes
   * Must be called after construction before using the service
   */
  async initialize(): Promise<void> {
    await Promise.all([
      this.qdrant.ensureCollectionWithIndexes(this.TRANSACTIONS_COLLECTION),
      this.qdrant.ensureCollectionWithIndexes(this.RECURRING_TRANSACTIONS_COLLECTION)
    ]);
  }

  /**
   * Embed a transaction in the vector store
   */
  async embedTransaction(
    input: TransactionEmbeddingInput
  ): Promise<ServiceResult<EmbeddingOperationResult>> {
    try {
      const collection = input.kind === 'recurring' 
        ? this.RECURRING_TRANSACTIONS_COLLECTION 
        : this.TRANSACTIONS_COLLECTION;
      
      const description = TransactionEmbeddingHelpers.generateDescription(input);
      const metadata = TransactionEmbeddingHelpers.buildMetadata(input.id, input.type, input.userId);

      console.log(`[TransactionEmbedding] Embedding ${input.kind} transaction ${input.id} for user ${input.userId} in collection ${collection}`);
      console.log(`[TransactionEmbedding] Description: "${description.substring(0, 50)}${description.length > 50 ? '...' : ''}"}`);

      // Generate embedding vector
      const vector = await this.embedder.embedText(description);

      // Store in Qdrant
      const embeddingId = uuidv4();
      const payload: Payload = { 
        description, 
        metadata: metadata as unknown as Record<string, unknown> 
      };
      await this.qdrant.upsertPoint(collection, embeddingId, vector, payload);

      console.log(`[TransactionEmbedding] Successfully embedded ${input.id} with Qdrant ID: ${embeddingId}`);

      return success(
        { embeddingId, transactionId: input.id },
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
      const collection = input.kind === 'recurring' 
        ? this.RECURRING_TRANSACTIONS_COLLECTION 
        : this.TRANSACTIONS_COLLECTION;
      
      const description = TransactionEmbeddingHelpers.generateDescription(input);
      const metadata = TransactionEmbeddingHelpers.buildMetadata(input.id, input.type, input.userId);

      console.log(`[TransactionEmbedding] Updating ${input.kind} transaction ${input.id} for user ${input.userId} in collection ${collection}`);
      console.log(`[TransactionEmbedding] New description: "${description.substring(0, 50)}${description.length > 50 ? '...' : ''}"}`);

      // Find existing point by transactionId
      const found = await this.qdrant.findPointByKey(collection, 'transactionId', input.id);
      if (!found) {
        throw new Error(`No point found with transactionId: ${input.id}`);
      }

      // Generate new embedding and update
      const newVector = await this.embedder.embedText(description);
      const newPayload: Payload = {
        description,
        metadata: metadata as unknown as Record<string, unknown>,
      };
      await this.qdrant.upsertPoint(collection, found.id, newVector, newPayload);

      console.log(`[TransactionEmbedding] Successfully updated ${input.id} with Qdrant ID: ${found.id}`);

      return success(
        { embeddingId: found.id, transactionId: input.id },
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
   * Private helper to search transactions by natural language description
   */
  private async searchByDescription(
    userId: string,
    query: string,
    kind: 'onetime' | 'recurring',
    k = 20
  ): Promise<ServiceResult<TransactionSearchMatch[]>> {
    const collection = kind === 'recurring' 
      ? this.RECURRING_TRANSACTIONS_COLLECTION 
      : this.TRANSACTIONS_COLLECTION;
    const kindLabel = kind === 'recurring' ? 'recurring' : 'one-time';

    console.log(`[TransactionEmbedding] Searching ${kindLabel} transactions for user ${userId} with query: "${query}" (threshold=${this.threshold})`);

    try {
      // Generate query embedding
      const vector = await this.embedder.embedText(query);

      // Build userId filter for Qdrant
      const userFilter = {
        must: [
          { key: "metadata.userId", match: { value: userId } }
        ]
      };
      console.log(`[TransactionEmbedding] Applying userId filter: ${userId}`);

      // Search in appropriate collection
      const hits = await this.qdrant.queryVector(collection, vector, k, userFilter);
      console.log(`[TransactionEmbedding] Vector search returned ${hits.length} hits from ${collection} (user-filtered)`);

      // Filter by threshold and build matches
      const filteredHits = hits.filter(hit => (hit.score ?? 0) >= this.threshold);
      console.log(`[TransactionEmbedding] ${filteredHits.length} results above threshold ${this.threshold}`);

      const matches: TransactionSearchMatch[] = filteredHits.map(hit => {
        const metadata = hit.payload?.metadata as any;
        return {
          id: metadata?.transactionId ?? '',
          kind,
          score: hit.score ?? 0,
        };
      });

      console.log(`[TransactionEmbedding] Search completed: ${matches.length} ${kindLabel} transactions matched for user ${userId}`);

      return success(
        matches,
        `Found ${matches.length} matching ${kindLabel} transactions`
      );
    } catch (error) {
      console.error(`[TransactionEmbedding] ${kindLabel} transaction search failed for user ${userId}:`, error);
      return failure(
        `Failed to search ${kindLabel} transactions`,
        'SEARCH_ERROR',
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  /**
   * Search one-time transactions by natural language description
   * Returns lightweight matches with IDs and scores
   * Caller is responsible for fetching full transaction data if needed
   */
  async searchTransactionsByDescription(
    userId: string,
    query: string,
    k = 20
  ): Promise<ServiceResult<TransactionSearchMatch[]>> {
    return this.searchByDescription(userId, query, 'onetime', k);
  }

  /**
   * Search recurring transactions by natural language description
   * Returns lightweight matches with IDs and scores
   * Caller is responsible for fetching full transaction data if needed
   */
  async searchRecurringTransactionsByDescription(
    userId: string,
    query: string,
    k = 20
  ): Promise<ServiceResult<TransactionSearchMatch[]>> {
    return this.searchByDescription(userId, query, 'recurring', k);
  }
}
