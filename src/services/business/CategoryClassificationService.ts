import { Embedder } from '../ai/embedding/Embedder';
import { QdrantService } from '../ai/embedding/QdrantService';
import { TransactionType } from '../../config/transactionTypes';
import { CategoryNormalizer } from '../../lib/CategoryNormalizer';
import { CategoryExemplarSeeder } from './category/CategoryExemplarSeeder';

export interface CategoryClassificationResult {
  category: string;
  confidence: number;
  method: 'explicit' | 'embedding' | 'default';
  alternatives?: Array<{ category: string; confidence: number }>;
}

/**
 * Service for classifying transaction categories using embedding-based semantic search
 * Uses Qdrant vector database with pre-seeded category exemplars
 * Slimmed down version - seeding logic moved to CategoryExemplarSeeder
 */
export class CategoryClassificationService {
  private readonly EXPENSE_EXEMPLARS_COLLECTION = 'expense_category_exemplars';
  private readonly INCOME_EXEMPLARS_COLLECTION = 'income_category_exemplars';
  
  private initialized = false;

  constructor(
    private embedder: Embedder,
    private qdrant: QdrantService,
    private seeder: CategoryExemplarSeeder
  ) {}

  /**
   * Initialize collections and seed category exemplars
   * Should be called once during application startup
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      console.log('[CategoryClassificationService] Already initialized, skipping');
      return;
    }

    try {
      await this.seeder.seedAllExemplars();
      this.initialized = true;
      console.log('[CategoryClassificationService] Initialized successfully');
    } catch (error) {
      console.error('[CategoryClassificationService] Initialization failed:', error);
      throw error;
    }
  }

  /**
   * Classify category based on description and transaction type
   * 
   * @param description - Transaction description
   * @param type - Transaction type (expense or income)
   * @param explicitCategory - Optional explicit category from user/AI
   * @returns Classification result with category and confidence
   */
  async classifyCategory(
    description: string | undefined,
    type: TransactionType,
    explicitCategory?: string
  ): Promise<CategoryClassificationResult> {
    // 1. If category explicitly provided → validate and use
    if (explicitCategory) {
      const normalized = CategoryNormalizer.normalize(explicitCategory, type);
      return {
        category: normalized.category,
        confidence: 1.0,
        method: 'explicit',
      };
    }

    // 2. Embed description and find closest match
    if (description && description.trim().length > 0) {
      return await this.classifyByEmbedding(description, type);
    }

    // 3. No description → default to 'Other'
    console.log('[CategoryClassificationService] No description provided, defaulting to Other');
    return {
      category: 'Other',
      confidence: 0.0,
      method: 'default',
    };
  }

  /**
   * Classify using embedding similarity search
   */
  private async classifyByEmbedding(
    description: string,
    type: TransactionType
  ): Promise<CategoryClassificationResult> {
    try {
      // Embed the description
      const embedding = await this.embedder.embedText(description);

      // Search in appropriate collection
      const collection =
        type === TransactionType.EXPENSE
          ? this.EXPENSE_EXEMPLARS_COLLECTION
          : this.INCOME_EXEMPLARS_COLLECTION;

      const results = await this.qdrant.search(collection, embedding, 3);

      if (results.length === 0) {
        console.warn('[CategoryClassificationService] No embedding results found, defaulting to Other');
        return {
          category: 'Other',
          confidence: 0.0,
          method: 'default',
        };
      }

      const topResult = results[0];
      console.log(
        `[CategoryClassificationService] Classified as ${topResult.payload.category} ` +
        `(confidence: ${topResult.score.toFixed(3)}, method: embedding)`
      );

      return {
        category: topResult.payload.category,
        confidence: topResult.score,
        method: 'embedding',
        alternatives: results.slice(1, 3).map((r) => ({
          category: r.payload.category,
          confidence: r.score,
        })),
      };
    } catch (error) {
      console.error('[CategoryClassificationService] Embedding classification failed:', error);
      return {
        category: 'Other',
        confidence: 0.0,
        method: 'default',
      };
    }
  }
}
