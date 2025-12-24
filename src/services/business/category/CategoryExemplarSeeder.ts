import { Embedder } from '../../ai/embedding/Embedder';
import { QdrantService } from '../../ai/embedding/QdrantService';

interface CategoryExemplar {
  category: string;
  examples: string[];
}

/**
 * Service for seeding category exemplars into Qdrant vector database
 * Separated from classification logic for better maintainability
 */
export class CategoryExemplarSeeder {
  private readonly EXPENSE_EXEMPLARS_COLLECTION = 'expense_category_exemplars';
  private readonly INCOME_EXEMPLARS_COLLECTION = 'income_category_exemplars';
  private readonly EMBEDDING_DIMENSION = 3072; // Google embedding model dimension

  constructor(
    private embedder: Embedder,
    private qdrant: QdrantService
  ) {}

  /**
   * Seed both expense and income category exemplars
   * Should be called once during application startup
   */
  async seedAllExemplars(): Promise<void> {
    console.log('[CategoryExemplarSeeder] Seeding category exemplars...');
    
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

    console.log('[CategoryExemplarSeeder] Seeding complete');
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
    console.log(`[CategoryExemplarSeeder] Seeding collection: ${collection}`);

    // Check if collection exists, create if not
    const collections = await this.qdrant.listCollections();
    if (!collections.includes(collection)) {
      await this.qdrant.createCollection(collection, this.EMBEDDING_DIMENSION);
      console.log(`[CategoryExemplarSeeder] Created collection: ${collection}`);
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
    console.log(`[CategoryExemplarSeeder] Batch embedding ${allExamples.length} examples...`);
    const embeddings = await this.embedder.embedTexts(allExamples);

    // Build points with embeddings
    const points = embeddings.map((embedding, index) => ({
      id: index + 1,
      vector: embedding,
      payload: exampleMetadata[index],
    }));

    await this.qdrant.upsertBatch(collection, points);
    console.log(`[CategoryExemplarSeeder] Seeded ${points.length} exemplars to ${collection}`);
  }
}
