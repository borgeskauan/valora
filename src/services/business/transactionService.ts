import { Transaction, TransactionResult, TransactionData, TransactionUpdateData } from '../../types/models';
import { success, failure, ServiceResult } from '../../types/serviceResult';
import { PrismaClient } from '../../generated/prisma';
import { MessageBuilder } from '../../lib/MessageBuilder';
import { PrismaClientManager } from '../../lib/PrismaClientManager';
import { TransactionType } from '../../config/transactionTypes';
import { TransactionQueryService } from './transactionQueryService';
import { TransactionEmbeddingService } from '../ai/embedding/transactionEmbeddingService';
import { TransactionValidator } from '../../validators/TransactionValidator';
import { CategoryNormalizer } from '../../lib/CategoryNormalizer';
import { validateBasicTransactionData, buildBasicUpdateData, handleDatabaseError } from '../../lib/transactionValidation';

export class TransactionService {
  private userId: string;
  private prisma: PrismaClient;
  private messageBuilder: MessageBuilder;
  private queryService: TransactionQueryService;
  private embeddingService: TransactionEmbeddingService;
  private validator: TransactionValidator;
  private categoryNormalizer: CategoryNormalizer;

  constructor(userId: string, embeddingService: TransactionEmbeddingService) {
    this.userId = userId;
    this.prisma = PrismaClientManager.getClient();
    this.messageBuilder = new MessageBuilder();
    this.queryService = new TransactionQueryService();
    this.embeddingService = embeddingService;
    this.validator = new TransactionValidator();
    this.categoryNormalizer = new CategoryNormalizer();
  }

  /**
   * Add a new transaction
   */
  async addTransaction(transactionData: Transaction): Promise<TransactionResult> {
    // Inject user ID directly
    transactionData.userId = this.userId;
    
    // Store original category before normalization
    const originalCategory = transactionData.category;
    
    // Validate basic transaction data (amount, date, category, type) using pure function
    const validationResult = validateBasicTransactionData(
      transactionData.amount,
      transactionData.category,
      transactionData.type,
      transactionData.date,
      this.validator,
      this.categoryNormalizer,
      this.messageBuilder
    );
    
    if (!validationResult.isValid) {
      return failure(
        'Validation failed',
        'VALIDATION_ERROR',
        validationResult.validationErrors?.join('; '),
        validationResult.validationErrors
      );
    }

    // Use validated and normalized data
    transactionData.category = validationResult.normalizedCategory;
    const normalizedDate = validationResult.normalizedDate;

    try {
      // Create transaction directly with Prisma
      const transaction = await this.prisma.transaction.create({
        data: {
          userId: transactionData.userId,
          date: normalizedDate,
          amount: transactionData.amount,
          category: transactionData.category,
          description: transactionData.description,
          type: transactionData.type,
        }
      });
    
      console.log(`Transaction added: $${transaction.amount} for ${transaction.category} on ${transaction.date} (${transaction.type})`);
      
      // Embed the transaction
      const embeddingResult = await this.embeddingService.embedTransaction({
        id: transaction.id,
        description: transaction.description,
        type: transaction.type as TransactionType,
        kind: 'onetime',
        amount: transaction.amount,
        category: transaction.category,
        date: transaction.date,
        userId: transaction.userId,
      });

      if (!embeddingResult.success) {
        return failure(
          'Failed to create transaction embedding',
          'EMBEDDING_ERROR',
          embeddingResult.message
        );
      }
      
      // Build success message using MessageBuilder
      const message = this.messageBuilder.buildTransactionCreatedMessage(
        transaction,
        { 
          category: validationResult.normalizedCategory, 
          wasNormalized: validationResult.warnings.length > 0,
          originalCategory: validationResult.warnings.length > 0 ? originalCategory : undefined
        }
      );

      // Return structured result with warnings from validation
      return success(
        {
          id: transaction.id,
          amount: transaction.amount,
          category: transaction.category,
          description: transaction.description,
          date: transaction.date,
          type: transaction.type as TransactionType
        },
        message,
        validationResult.warnings.length > 0 ? validationResult.warnings : undefined
      );
    } catch (error) {
      return handleDatabaseError(error, 'adding the transaction');
    }
  }

  /**
   * Build update data object by validating all changes at once
   * Uses pure functions for validation logic
   */
  private buildTransactionUpdateData(
    updates: TransactionUpdateData,
    existingTransaction: TransactionData
  ): { result?: TransactionResult; updateData?: any; warnings: string[]; originalCategory?: string } {
    // Use pure function to handle basic fields validation and merging
    const basicUpdateResult = buildBasicUpdateData(
      updates,
      existingTransaction,
      'date',
      this.validator,
      this.categoryNormalizer,
      this.messageBuilder
    );

    if (!basicUpdateResult.isValid) {
      return {
        result: failure(
          'Validation failed',
          'VALIDATION_ERROR',
          basicUpdateResult.validationErrors?.join('; '),
          basicUpdateResult.validationErrors
        ),
        warnings: [],
      };
    }

    // Handle date field (transaction-specific)
    if (updates.date !== undefined) {
      const dateValidation = validateBasicTransactionData(
        updates.amount || existingTransaction.amount,
        updates.category || existingTransaction.category,
        (updates.type || existingTransaction.type) as TransactionType,
        updates.date,
        this.validator,
        this.categoryNormalizer,
        this.messageBuilder
      );

      if (!dateValidation.isValid) {
        return {
          result: failure(
            'Validation failed',
            'VALIDATION_ERROR',
            dateValidation.validationErrors?.join('; '),
            dateValidation.validationErrors
          ),
          warnings: [],
        };
      }

      basicUpdateResult.updateData!.date = dateValidation.normalizedDate;
    }

    return {
      updateData: basicUpdateResult.updateData,
      warnings: basicUpdateResult.warnings,
      originalCategory: basicUpdateResult.originalCategory,
    };
  }

  /**
   * Update an existing transaction
   * @param id - Transaction ID to update
   * @param updates - Partial transaction data to update
   * @param existingTransaction - The existing transaction data (already validated for ownership)
   * @returns ServiceResult with updated transaction
   */
  async updateTransaction(
    id: string,
    updates: TransactionUpdateData,
    existingTransaction: TransactionData
  ): Promise<TransactionResult> {
    try {
      // Build and validate update data
      const buildResult = this.buildTransactionUpdateData(updates, existingTransaction);
      
      if (buildResult.result) {
        return buildResult.result; // Validation error
      }

      const { updateData, warnings: validationWarnings, originalCategory } = buildResult;

      // Perform the update
      const updatedTransaction = await this.prisma.transaction.update({
        where: { id },
        data: updateData,
      });

      console.log(`Transaction updated: ID ${id}, changes:`, updateData);

      // Update the embedding
      const embeddingResult = await this.embeddingService.updateTransactionEmbedding({
        id: updatedTransaction.id,
        description: updatedTransaction.description,
        type: updatedTransaction.type as TransactionType,
        kind: 'onetime',
        amount: updatedTransaction.amount,
        category: updatedTransaction.category,
        date: updatedTransaction.date,
        userId: updatedTransaction.userId,
      });

      if (!embeddingResult.success) {
        return failure(
          'Failed to update transaction embedding',
          'EMBEDDING_ERROR',
          embeddingResult.message
        );
      }

      // Build success message
      const message = this.messageBuilder.buildTransactionUpdatedMessage(
        existingTransaction,
        {
          id: updatedTransaction.id,
          amount: updatedTransaction.amount,
          category: updatedTransaction.category,
          description: updatedTransaction.description,
          date: updatedTransaction.date,
          type: updatedTransaction.type as TransactionType,
        },
        {
          category: updateData!.category,
          wasNormalized: validationWarnings.length > 0,
          originalCategory: validationWarnings.length > 0 ? originalCategory : undefined,
        }
      );

      return success(
        {
          id: updatedTransaction.id,
          amount: updatedTransaction.amount,
          category: updatedTransaction.category,
          description: updatedTransaction.description,
          date: updatedTransaction.date,
          type: updatedTransaction.type as TransactionType,
        },
        message,
        validationWarnings.length > 0 ? validationWarnings : undefined
      );
    } catch (error) {
      return this.baseOps.handleDatabaseError(error, 'updating the transaction');
    }
  }

  /**
   * Edit the last transaction for the current user
   * High-level method that queries and updates in one call
   * @param updates - Fields to update
   * @param transactionType - Optional type filter (expense or income)
   * @returns ServiceResult with updated transaction
   */
  async editLastTransaction(
    updates: TransactionUpdateData,
    transactionType?: TransactionType
  ): Promise<TransactionResult> {
    // Get userId from injected context (same pattern as injectUserId)
    const userIdObj: { userId?: string } = {};
    this.baseOps.injectUserId(userIdObj);
    const userId = userIdObj.userId || '';
    
    if (!userId) {
      return failure(
        'User context not available',
        'MISSING_CONTEXT',
        'Unable to identify user for transaction lookup'
      );
    }

    // Query for last transaction
    const lastTxResult = await this.queryService.getLastTransactionByUser(userId, transactionType);
    
    if (!lastTxResult.success) {
      return lastTxResult;
    }

    // Update the transaction (passing existing data to avoid redundant query)
    return await this.updateTransaction(lastTxResult.data!.id, updates, lastTxResult.data!);
  }

  /**
   * Edit a specific transaction by ID
   * @param id - Transaction ID
   * @param updates - Fields to update
   * @returns ServiceResult with updated transaction or error
   */
  async editTransactionById(
    id: string,
    updates: TransactionUpdateData
  ): Promise<TransactionResult> {
    // Get userId from injected context (same pattern as editLastTransaction)
    const userIdObj: { userId?: string } = {};
    this.baseOps.injectUserId(userIdObj);
    const userId = userIdObj.userId || '';
    
    if (!userId) {
      return failure(
        'User context not available',
        'MISSING_CONTEXT',
        'Unable to identify user for transaction lookup'
      );
    }

    // Query for transaction by ID with ownership validation
    const transactionResult = await this.queryService.getTransactionById(id, userId);
    
    if (!transactionResult.success) {
      return transactionResult;
    }

    // Update the transaction (passing existing data to avoid redundant query)
    return await this.updateTransaction(id, updates, transactionResult.data!);
  }

  /**
   * Delete one or multiple transactions by IDs
   * @param ids - Array of transaction IDs to delete
   * @returns ServiceResult with count of deleted transactions
   */
  async deleteTransactions(
    ids: string[]
  ): Promise<ServiceResult<{ deletedCount: number }>> {
    // Validate IDs array
    if (!ids || ids.length === 0) {
      return failure(
        'No transaction IDs provided',
        'VALIDATION_ERROR',
        'Please provide at least one transaction ID to delete.'
      );
    }

    // Get userId from injected context
    const userIdObj: { userId?: string } = {};
    this.baseOps.injectUserId(userIdObj);
    const userId = userIdObj.userId || '';
    
    if (!userId) {
      return failure(
        'User context not available',
        'MISSING_CONTEXT',
        'Unable to identify user for transaction deletion'
      );
    }

    try {
      // Step 1: Fetch all transactions matching IDs and userId
      const transactions = await this.prisma.transaction.findMany({
        where: {
          id: { in: ids },
          userId
        },
        select: { id: true }
      });

      // Step 2: Check if all requested IDs were found
      const foundIds = transactions.map(t => t.id);
      const missingIds = ids.filter(id => !foundIds.includes(id));

      // Step 3: If any missing, return failure (all-or-nothing)
      if (missingIds.length > 0) {
        return failure(
          `Transactions not found or unauthorized: ${missingIds.join(', ')}`,
          'NOT_FOUND',
          'Some transactions do not exist or you do not have access to them.'
        );
      }

      // Step 4: Delete all transactions (ownership already validated)
      const result = await this.prisma.transaction.deleteMany({
        where: {
          id: { in: ids },
          userId // Extra safety
        }
      });

      console.log(`Deleted ${result.count} transaction(s) for user ${userId}`);

      // Build success message
      const message = result.count === 1 
        ? 'Deleted 1 transaction'
        : `Deleted ${result.count} transactions`;

      return success(
        { deletedCount: result.count },
        message
      );
    } catch (error) {
      return this.baseOps.handleDatabaseError(error, 'deleting transaction(s)');
    }
  }
}
