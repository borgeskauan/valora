import { Embedder } from '../ai/embedding/Embedder';
import { QdrantService } from '../ai/embedding/QdrantService';
import { TransactionType } from '../../config/transactionTypes';
import { CategoryNormalizer } from '../../lib/CategoryNormalizer';

export interface CategoryClassificationResult {
  category: string;
  confidence: number;
  method: 'explicit' | 'embedding' | 'default';
  alternatives?: Array<{ category: string; confidence: number }>;
}

interface CategoryExemplar {
  category: string;
  examples: string[];
}

/**
 * Service for classifying transaction categories using embedding-based semantic search
 * Uses Qdrant vector database with pre-seeded category exemplars
 */
export class CategoryClassificationService {
  private readonly EXPENSE_EXEMPLARS_COLLECTION = 'expense_category_exemplars';
  private readonly INCOME_EXEMPLARS_COLLECTION = 'income_category_exemplars';
  private readonly EMBEDDING_DIMENSION = 3072; // Google embedding model dimension
  
  private initialized = false;

  constructor(
    private embedder: Embedder,
    private qdrant: QdrantService
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
      await this.seedCategoryExemplars();
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

  /**
   * Seed Qdrant with category exemplar embeddings
   */
  private async seedCategoryExemplars(): Promise<void> {
    console.log('[CategoryClassificationService] Seeding category exemplars...');
    
    const expenseExemplars = this.buildExpenseExemplars();
    const incomeExemplars = this.buildIncomeExemplars();

    await this.embedAndStoreExemplars(
      expenseExemplars,
      this.EXPENSE_EXEMPLARS_COLLECTION
    );  
    await this.embedAndStoreExemplars(
      incomeExemplars,
      this.INCOME_EXEMPLARS_COLLECTION
    );
  }

  /**
   * Build expense category exemplars with diverse examples
   */
  private buildExpenseExemplars(): CategoryExemplar[] {
    return [
      {
        category: 'Housing',
        examples: [
          'monthly rent payment',
          'mortgage payment',
          'property tax bill',
          'home repair service',
          'HOA monthly fee',
        ],
      },
      {
        category: 'Groceries',
        examples: [
          'weekly grocery shopping',
          'supermarket trip',
          'farmers market produce',
          'costco bulk groceries',
          'whole foods shopping',
        ],
      },
      {
        category: 'Transportation',
        examples: [
          'uber ride home',
          'lyft to airport',
          'gas station fill up',
          'metro card monthly pass',
          'parking garage downtown',
          'car maintenance oil change',
        ],
      },
      {
        category: 'Bills',
        examples: [
          'electric bill payment',
          'internet service bill',
          'phone bill monthly',
          'water utility bill',
          'netflix subscription',
          'spotify premium',
        ],
      },
      {
        category: 'Insurance',
        examples: [
          'car insurance premium',
          'health insurance payment',
          'home insurance annual',
          'life insurance monthly',
        ],
      },
      {
        category: 'Taxes & Fees',
        examples: [
          'income tax payment',
          'property tax installment',
          'bank overdraft fee',
          'late payment fee',
          'government filing fee',
        ],
      },
      {
        category: 'Health',
        examples: [
          'doctor visit copay',
          'pharmacy prescription',
          'dental checkup',
          'therapy session',
          'medical test lab work',
        ],
      },
      {
        category: 'Savings & Investments',
        examples: [
          'transfer to savings account',
          'investment contribution',
          'retirement fund deposit',
          'brokerage account funding',
          'crypto purchase',
        ],
      },
      {
        category: 'Food & Dining',
        examples: [
          'coffee at starbucks',
          'dinner at restaurant',
          'lunch delivery chipotle',
          'pizza hut takeout',
          'brunch with friends',
          'doordash food order',
        ],
      },
      {
        category: 'Entertainment',
        examples: [
          'movie tickets',
          'concert tickets',
          'casino gambling',
          'video game purchase',
          'streaming service',
          'hobby supplies',
        ],
      },
      {
        category: 'Travel',
        examples: [
          'flight booking',
          'hotel reservation',
          'airbnb rental',
          'vacation package',
          'travel insurance',
        ],
      },
      {
        category: 'Fitness',
        examples: [
          'gym membership monthly',
          'yoga class',
          'personal training session',
          'sports equipment',
          'fitness app subscription',
        ],
      },
      {
        category: 'Personal Care',
        examples: [
          'haircut at salon',
          'spa treatment',
          'cosmetics purchase',
          'grooming products',
          'beauty treatment',
        ],
      },
      {
        category: 'Shopping',
        examples: [
          'clothing purchase',
          'electronics at best buy',
          'furniture from ikea',
          'home decor',
          'amazon shopping',
        ],
      },
      {
        category: 'Pets',
        examples: [
          'pet food purchase',
          'vet visit',
          'dog grooming',
          'cat litter',
          'pet insurance',
        ],
      },
      {
        category: 'Education',
        examples: [
          'tuition payment',
          'online course fee',
          'textbook purchase',
          'certification exam',
          'training workshop',
        ],
      },
      {
        category: 'Gifts & Donations',
        examples: [
          'birthday gift',
          'charity donation',
          'church tithe',
          'wedding gift',
          'fundraiser contribution',
        ],
      },
      {
        category: 'Other',
        examples: [
          'miscellaneous expense',
          'one-time payment',
          'unusual purchase',
          'uncategorized spending',
        ],
      },
    ];
  }

  /**
   * Build income category exemplars with diverse examples
   */
  private buildIncomeExemplars(): CategoryExemplar[] {
    return [
      {
        category: 'Salary',
        examples: [
          'monthly paycheck',
          'biweekly salary deposit',
          'employer payment',
          'wages from work',
          'payroll direct deposit',
        ],
      },
      {
        category: 'Business Income',
        examples: [
          'business revenue',
          'owner draw',
          'business profit distribution',
          'company income',
          'self-employed earnings',
        ],
      },
      {
        category: 'Freelance',
        examples: [
          'freelance project payment',
          'consulting fee',
          'gig work payment',
          'upwork contract payment',
          'contract work invoice',
        ],
      },
      {
        category: 'Bonuses',
        examples: [
          'year-end bonus',
          'performance bonus',
          'sales commission',
          'tip income',
          'incentive payment',
        ],
      },
      {
        category: 'Investment Returns',
        examples: [
          'stock dividend',
          'investment interest',
          'capital gains',
          'bond coupon payment',
          'portfolio return',
        ],
      },
      {
        category: 'Rental Income',
        examples: [
          'rent payment received',
          'property rental income',
          'airbnb guest payment',
          'room rental',
        ],
      },
      {
        category: 'Refunds',
        examples: [
          'tax refund',
          'purchase refund',
          'reimbursement from employer',
          'cashback rebate',
          'chargeback credit',
        ],
      },
      {
        category: 'Gifts Received',
        examples: [
          'birthday gift money',
          'holiday gift',
          'family gift',
          'wedding gift cash',
        ],
      },
      {
        category: 'Loans Received',
        examples: [
          'personal loan received',
          'borrowed money',
          'credit line draw',
          'payday advance',
        ],
      },
      {
        category: 'Other',
        examples: [
          'miscellaneous income',
          'one-time payment',
          'unusual income',
          'uncategorized receipt',
        ],
      },
    ];
  }

  /**
   * Embed exemplars and store in Qdrant
   */
  private async embedAndStoreExemplars(
    exemplars: CategoryExemplar[],
    collection: string
  ): Promise<void> {
    console.log(`[CategoryClassificationService] Seeding collection: ${collection}`);

    // Check if collection exists, create if not
    const collections = await this.qdrant.listCollections();
    if (!collections.includes(collection)) {
      await this.qdrant.createCollection(collection, this.EMBEDDING_DIMENSION);
      console.log(`[CategoryClassificationService] Created collection: ${collection}`);
    }

    // Collect all examples and embed them in batches
    const allExamples: string[] = [];
    const exampleMetadata: Array<{ category: string; example: string }> = [];
    
    for (const exemplar of exemplars) {
      for (const example of exemplar.examples) {
        allExamples.push(example);
        exampleMetadata.push({
          category: exemplar.category,
          example,
        });
      }
    }

    // Batch embed all examples at once
    console.log(`[CategoryClassificationService] Batch embedding ${allExamples.length} examples...`);
    const embeddings = await this.embedder.embedTexts(allExamples);

    // Build points with embeddings
    const points = embeddings.map((embedding, index) => ({
      id: index + 1,
      vector: embedding,
      payload: exampleMetadata[index],
    }));

    await this.qdrant.upsertBatch(collection, points);
    console.log(`[CategoryClassificationService] Seeded ${points.length} exemplars to ${collection}`);
  }
}
