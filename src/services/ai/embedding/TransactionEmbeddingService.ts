import { ServiceResult, success, failure } from '../../../types/serviceResult';
import {
  TransactionEmbeddingInput,
  TransactionEmbeddingMetadata,
  TransactionSearchMatch,
  EmbeddingOperationResult,
} from '../../../types/embedding';
import { config } from '../../../config/config';
import { Embedder } from './embedder';
import { QdrantService, Payload } from './qdrant';
import { TransactionEmbeddingHelpers } from '../../../lib/TransactionEmbeddingHelpers';
import { v4 as uuidv4 } from 'uuid';

export class TransactionEmbeddingService {
  private embedder: Embedder;
  private qdrant: QdrantService;
  private threshold: number;
  private collectionEnsured: boolean = false;

  constructor(embedder?: Embedder, qdrant?: QdrantService) {
    this.embedder = embedder ?? new Embedder();
    this.qdrant = qdrant ?? new QdrantService();
    this.threshold = config.embeddingThreshold;
  }

  /**
   * Ensure Qdrant collection is created with proper indexes
   */
  private async ensureCollectionCreated(): Promise<void> {
    if (!this.collectionEnsured) {
      await this.qdrant.ensureCollectionWithDescriptionIndex();
      this.collectionEnsured = true;
    }
  }

  /**
   * Embed a transaction in the vector store
   */
  async embedTransaction(
    input: TransactionEmbeddingInput
  ): Promise<ServiceResult<EmbeddingOperationResult>> {
    try {
      const prefixedId = TransactionEmbeddingHelpers.buildPrefixedId(input.id, input.kind);
      const description = TransactionEmbeddingHelpers.generateDescription(input);
      const metadata = TransactionEmbeddingHelpers.buildMetadata(prefixedId, input.type, input.kind, input.userId);

      console.log(`[TransactionEmbedding] Embedding ${input.kind} transaction ${prefixedId} for user ${input.userId}`);
      console.log(`[TransactionEmbedding] Description: "${description.substring(0, 50)}${description.length > 50 ? '...' : ''}"}`);

      // Generate embedding vector
      const vector = await this.embedder.embedText(description);
      await this.ensureCollectionCreated();

      // Store in Qdrant
      const qdrantId = uuidv4();
      const payload: Payload = { 
        description, 
        metadata: metadata as unknown as Record<string, unknown> 
      };
      await this.qdrant.upsertPoint(qdrantId, vector, payload);

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
      const prefixedId = TransactionEmbeddingHelpers.buildPrefixedId(input.id, input.kind);
      const description = TransactionEmbeddingHelpers.generateDescription(input);
      const metadata = TransactionEmbeddingHelpers.buildMetadata(prefixedId, input.type, input.kind, input.userId);

      console.log(`[TransactionEmbedding] Updating ${input.kind} transaction ${prefixedId} for user ${input.userId}`);
      console.log(`[TransactionEmbedding] New description: "${description.substring(0, 50)}${description.length > 50 ? '...' : ''}"}`);

      await this.ensureCollectionCreated();

      // Find existing point by transactionId
      const found = await this.qdrant.findPointByKey('transactionId', prefixedId);
      if (!found) {
        throw new Error(`No point found with transactionId: ${prefixedId}`);
      }

      // Generate new embedding and update
      const newVector = await this.embedder.embedText(description);
      const newPayload: Payload = {
        description,
        metadata: metadata as unknown as Record<string, unknown>,
      };
      await this.qdrant.upsertPoint(found.id, newVector, newPayload);

      console.log(`[TransactionEmbedding] Successfully updated ${prefixedId} with Qdrant ID: ${found.id}`);

      return success(
        { qdrantId: found.id, transactionId: prefixedId },
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
   * Returns lightweight matches with IDs and scores
   * Caller is responsible for fetching full transaction data if needed
   */
  async searchTransactionsByDescription(
    userId: string,
    query: string,
    k = 20
  ): Promise<ServiceResult<TransactionSearchMatch[]>> {
    console.log(`[TransactionEmbedding] Searching transactions for user ${userId} with query: "${query}" (threshold=${this.threshold})`);

    try {
      // Generate query embedding
      const vector = await this.embedder.embedText(query);
      await this.ensureCollectionCreated();

      // Search in Qdrant
      const hits = await this.qdrant.queryVector(vector, k);
      console.log(`[TransactionEmbedding] Vector search returned ${hits.length} hits from Qdrant`);

      // Filter by threshold
      const filteredHits = hits.filter(hit => (hit.score ?? 0) >= this.threshold);
      console.log(`[TransactionEmbedding] ${filteredHits.length} results above threshold ${this.threshold}`);

      // Parse hits to extract IDs and scores
      const { onetimeIds, recurringIds, scoreMap } = TransactionEmbeddingHelpers.parseEmbeddingHits(filteredHits);
      console.log(`[TransactionEmbedding] Parsed ${onetimeIds.length} one-time and ${recurringIds.length} recurring transaction IDs`);

      // Build lightweight matches
      const matches: TransactionSearchMatch[] = [
        ...onetimeIds.map(id => ({
          id,
          kind: 'onetime' as const,
          score: scoreMap.get(`T-${id}`) ?? 0,
        })),
        ...recurringIds.map(id => ({
          id,
          kind: 'recurring' as const,
          score: scoreMap.get(`RT-${id}`) ?? 0,
        })),
      ];

      console.log(`[TransactionEmbedding] Search completed: ${matches.length} transactions matched for user ${userId}`);

      return success(
        matches,
        `Found ${matches.length} matching transactions`
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
}
