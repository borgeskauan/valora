import { GeminiConversationalService } from './ai/conversational/geminiService';
import { AIMessageService } from './ai/conversational/aiMessageService';
import { config } from '../config';
import { FunctionDeclarationService } from './ai/functionDeclarationService';
import { TransactionService } from './business/transactionService';
import { RecurringTransactionService } from './business/recurringTransactionService';
import { TransactionEmbeddingService } from './ai/embedding/transactionEmbeddingService';
import { UserContextProvider } from '../lib/UserContextProvider';
import { TransactionSearchService } from './business/search/TransactionSearchService';
import { MongoConnectionManager } from './infrastructure/database/MongoConnectionManager';
import { TransactionQueryService } from './infrastructure/database/TransactionQueryService';

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
      const transactionQueryService = new TransactionQueryService(transactionCollection, recurringCollection);

      // Business services
      const userContext = new UserContextProvider();
      const transactionEmbeddingService = new TransactionEmbeddingService(userContext);
      const transactionService = new TransactionService(userContext, transactionEmbeddingService);
      const recurringTransactionService = new RecurringTransactionService(userContext, transactionEmbeddingService);
      
      // Orchestration layer
      const transactionSearchService = new TransactionSearchService(userContext, transactionQueryService, transactionEmbeddingService);

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

      // Register services
      this.services.set('MongoConnectionManager', mongoConnectionManager);
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