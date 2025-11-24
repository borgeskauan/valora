import { GeminiConversationalService } from './ai/conversational/geminiService';
import { AIMessageService } from './ai/conversational/aiMessageService';
import { config } from '../config/config';
import { FunctionDeclarationService } from './ai/functionDeclarationService';
import { WhatsAppService } from './infrastructure/whatsappService';
import { ConversationService } from './infrastructure/conversationService';
import { TransactionService } from './business/TransactionService';
import { RecurringTransactionService } from './business/RecurringTransactionService';
import { TransactionEmbeddingService } from './ai/embedding/TransactionEmbeddingService';
import { FreeformTransactionSearchService } from './business/search/FreeformTransactionSearchService';
import { MongoConnectionManager } from './infrastructure/database/MongoConnectionManager';
import { MqlTransactionSearchService } from './infrastructure/database/MqlTransactionSearchService';
import { TransactionLookupService } from './business/TransactionLookupService';
import { Embedder } from './ai/embedding/Embedder';
import { QdrantService } from './ai/embedding/QdrantService';

export class DependencyService {
  private static instance: DependencyService;
  private services: Map<string, any> = new Map();
  private initialized: boolean = false;

  private constructor() {
    // Don't auto-initialize - must be done explicitly via initialize()
  }

  static getInstance(): DependencyService {
    if (!DependencyService.instance) {
      DependencyService.instance = new DependencyService();
    }
    return DependencyService.instance;
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      console.warn('DependencyService already initialized');
      return;
    }

    try {
      // Validate configuration internally
      if (!config.geminiApiKey) {
        throw new Error('GEMINI_API_KEY environment variable is required');
      }

      // Infrastructure layer
      const mongoConnectionManager = MongoConnectionManager.fromEnv();
      const [transactionCollection, recurringCollection] = await Promise.all([
        mongoConnectionManager.getTransactionCollection(),
        mongoConnectionManager.getRecurringTransactionCollection()
      ]);

      // Data access layer
      const transactionQueryService = new MqlTransactionSearchService(transactionCollection, recurringCollection);
      const transactionLookupService = new TransactionLookupService();

      // Embedding dependencies
      const embedder = new Embedder();
      const qdrant = new QdrantService();

      // Business services - no longer need userId in constructor
      const transactionEmbeddingService = new TransactionEmbeddingService(embedder, qdrant);
      await transactionEmbeddingService.initialize(); // Initialize collections
      
      const transactionService = new TransactionService(transactionEmbeddingService, transactionLookupService);
      const recurringTransactionService = new RecurringTransactionService(transactionEmbeddingService, transactionLookupService);
      
      // Orchestration layer
      const transactionSearchService = new FreeformTransactionSearchService(transactionQueryService, transactionEmbeddingService);

      const functionDeclarationService = new FunctionDeclarationService(
        transactionService,
        recurringTransactionService,
        transactionSearchService
      );

      // Create services with configuration from the config module
      const geminiService = new GeminiConversationalService(
        config.geminiApiKey,
        config.geminiModel,
        config.systemInstruction,
        functionDeclarationService
      );
      const aiMessageService = new AIMessageService(geminiService, functionDeclarationService);
      const whatsappService = new WhatsAppService();
      const conversationService = new ConversationService();

      // Register services
      this.services.set('MongoConnectionManager', mongoConnectionManager);
      this.services.set('WhatsAppService', whatsappService);
      this.services.set('ConversationService', conversationService);
      this.services.set('TransactionQueryService', transactionQueryService);
      this.services.set('TransactionSearchService', transactionSearchService);
      this.services.set('GeminiService', geminiService);
      this.services.set('AIMessageService', aiMessageService);
      this.services.set('functionDeclarationService', functionDeclarationService);
      this.services.set('TransactionEmbeddingService', transactionEmbeddingService);

      this.initialized = true;
      console.log('DependencyService initialized successfully');
      console.log(`Using model: ${config.geminiModel}`);
    } catch (error) {
      console.error('Failed to initialize DependencyService:', error);
      throw error;
    }
  }

  // Convenience getters for commonly used services
  get aiMessageService(): AIMessageService {
    return this.getService<AIMessageService>('AIMessageService');
  }

  get whatsappService(): WhatsAppService {
    return this.getService<WhatsAppService>('WhatsAppService');
  }

  get conversationService(): ConversationService {
    return this.getService<ConversationService>('ConversationService');
  }

  get transactionEmbeddingService(): TransactionEmbeddingService {
    return this.getService<TransactionEmbeddingService>('TransactionEmbeddingService');
  }

  private getService<T>(serviceName: string): T {
    if (!this.initialized) {
      throw new Error('DependencyService not initialized. Call initialize() first.');
    }

    const service = this.services.get(serviceName);
    if (!service) {
      throw new Error(`Service '${serviceName}' not found`);
    }

    return service as T;
  }
}

// Note: DependencyService must be initialized asynchronously
// See src/index.ts for initialization pattern