import { 
  RecurringTransactionInput, 
  RecurringTransactionResult, 
  RecurringTransactionData, 
  RecurringTransactionUpdateData 
} from '../../../types/models';
import { success, failure, ServiceResult } from '../../../types/serviceResult';
import { PrismaClient } from '../../../generated/prisma';
import { MessageBuilder } from '../../../lib/MessageBuilder';
import { PrismaClientManager } from '../../../lib/PrismaClientManager';
import { TransactionType } from '../../../config/transactionTypes';
import { CategoryClassificationService } from '../CategoryClassificationService';
import { DeletionStateService } from '../../infrastructure/DeletionStateService';
import { validateBasicTransactionData, buildBasicUpdateData, handleDatabaseError } from '../../../lib/transactionValidation';
import { RecurrencePatternService } from './RecurrencePatternService';
import { RecurringTransactionQueryService } from './RecurringTransactionQueryService';
import { RecurringTransactionSyncService } from './RecurringTransactionSyncService';

/**
 * Service for recurring transaction command operations (Create, Update, Disable)
 * Follows CQRS pattern - handles write operations only
 */
export class RecurringTransactionCommandService {
  private prisma: PrismaClient;

  constructor(
    private recurrencePatternService: RecurrencePatternService,
    private queryService: RecurringTransactionQueryService,
    private syncService: RecurringTransactionSyncService,
    private categoryClassifier: CategoryClassificationService,
    private deletionStateService: DeletionStateService
  ) {
    this.prisma = PrismaClientManager.getClient();
  }

  /**
   * Create a new recurring transaction
   * 
   * @param userId - User ID (injected by service layer)
   * @param data - Recurring transaction input data
   * @returns ServiceResult with created recurring transaction or error
   */
  async create(userId: string, data: RecurringTransactionInput): Promise<RecurringTransactionResult> {
    // Inject user ID directly
    data.userId = userId;

    // Store original category before normalization
    const originalCategory = data.category;

    // Classify category if not provided
    if (!data.category) {
      const classificationResult = await this.categoryClassifier.classifyCategory(
        data.description ?? undefined,
        data.type,
        undefined // no explicit category
      );
      data.category = classificationResult.category;
      console.log(
        `[RecurringTransactionCommandService] Auto-classified category: ${classificationResult.category} ` +
        `(confidence: ${classificationResult.confidence.toFixed(3)}, method: ${classificationResult.method})`
      );
    }

    // Validate basic transaction data (amount, category, type) using pure function
    const basicValidation = validateBasicTransactionData(
      data.amount,
      data.category,
      data.type,
      undefined // No date for recurring transactions
    );

    if (!basicValidation.isValid) {
      return failure(
        'Validation failed',
        'VALIDATION_ERROR',
        basicValidation.validationErrors?.join('; '),
        basicValidation.validationErrors
      );
    }

    // Use validated and normalized data
    data.category = basicValidation.normalizedCategory;

    // Validate recurrence pattern (domain-specific)
    const recurrenceValidation = this.recurrencePatternService.validate(
      data.amount,
      data.frequency,
      data.type,
      data.interval,
      data.dayOfWeek,
      data.dayOfMonth,
      data.monthOfYear
    );

    if (!recurrenceValidation.isValid) {
      return failure(
        'Validation failed',
        'VALIDATION_ERROR',
        recurrenceValidation.errors!.join('; '),
        recurrenceValidation.errors
      );
    }

    const recurrencePattern = recurrenceValidation.recurrencePattern!;
    const nextDue = recurrenceValidation.nextDue!;

    // Convert pattern to JSON for database
    const patternData = recurrencePattern.toJSON();

    try {
      // Create database record directly with Prisma
      const recurringTransaction = await this.prisma.recurringTransaction.create({
        data: {
          userId: data.userId,
          amount: data.amount,
          category: data.category,
          description: data.description || null,
          frequency: patternData.frequency,
          interval: patternData.interval,
          dayOfWeek: patternData.dayOfWeek,
          dayOfMonth: patternData.dayOfMonth,
          monthOfYear: patternData.monthOfYear,
          nextDue: nextDue,
          isActive: true,
          type: data.type,
        },
      });

      console.log(`Recurring transaction created: $${recurringTransaction.amount} for ${recurringTransaction.category} ${data.frequency} (${data.type})`);

      // Embed the recurring transaction (async, non-blocking)
      await this.syncService.syncEmbedding({
        id: recurringTransaction.id,
        amount: recurringTransaction.amount,
        category: recurringTransaction.category,
        description: recurringTransaction.description,
        frequency: recurringTransaction.frequency,
        interval: recurringTransaction.interval,
        dayOfWeek: recurringTransaction.dayOfWeek,
        dayOfMonth: recurringTransaction.dayOfMonth,
        monthOfYear: recurringTransaction.monthOfYear,
        nextDue: recurringTransaction.nextDue,
        type: recurringTransaction.type as TransactionType,
      }, recurringTransaction.userId);

      // Build success message using MessageBuilder static method
      const message = MessageBuilder.buildRecurringTransactionCreatedMessage(
        recurringTransaction,
        recurrencePattern,
        {
          category: basicValidation.normalizedCategory,
          wasNormalized: basicValidation.warnings.length > 0,
          originalCategory: basicValidation.warnings.length > 0 ? originalCategory : undefined
        }
      );

      // Return structured result with warnings from validation
      return success(
        {
          id: recurringTransaction.id,
          amount: recurringTransaction.amount,
          category: recurringTransaction.category,
          description: recurringTransaction.description,
          frequency: recurringTransaction.frequency,
          interval: recurringTransaction.interval,
          dayOfWeek: recurringTransaction.dayOfWeek,
          dayOfMonth: recurringTransaction.dayOfMonth,
          monthOfYear: recurringTransaction.monthOfYear,
          nextDue: recurringTransaction.nextDue,
          type: recurringTransaction.type as TransactionType
        },
        message,
        basicValidation.warnings.length > 0 ? basicValidation.warnings : undefined
      );
    } catch (error) {
      return handleDatabaseError(error, 'creating the recurring transaction');
    }
  }

  /**
   * Update an existing recurring transaction by ID
   * 
   * @param userId - User ID for ownership validation
   * @param id - Recurring transaction ID to update
   * @param updates - Partial recurring transaction data to update
   * @returns ServiceResult with updated recurring transaction or error
   */
  async updateById(
    userId: string,
    id: string,
    updates: RecurringTransactionUpdateData
  ): Promise<RecurringTransactionResult> {
    if (!userId) {
      return failure(
        'User context not available',
        'MISSING_CONTEXT',
        'Unable to identify user for recurring transaction lookup'
      );
    }

    // Query for recurring transaction by ID with ownership validation
    const recurringTxResult = await this.queryService.findById(userId, id);
    
    if (!recurringTxResult.success) {
      return recurringTxResult;
    }

    // Update the recurring transaction (passing existing data to avoid redundant query)
    return await this.update(id, updates, recurringTxResult.data!);
  }

  /**
   * Update the last recurring transaction for the current user
   * 
   * @param userId - User ID
   * @param updates - Fields to update
   * @param transactionType - Optional type filter (expense or income)
   * @returns ServiceResult with updated recurring transaction or error
   */
  async updateLast(
    userId: string,
    updates: RecurringTransactionUpdateData,
    transactionType?: TransactionType
  ): Promise<RecurringTransactionResult> {
    // Look up the specified recurring transaction
    const lastRecurringTxResult = await this.queryService.findLastByUser(userId, transactionType);
    
    if (!lastRecurringTxResult.success) {
      return lastRecurringTxResult;
    }

    // Update the recurring transaction (passing existing data to avoid redundant query)
    return await this.update(lastRecurringTxResult.data!.id, updates, lastRecurringTxResult.data!);
  }

  /**
   * Disable (deactivate) one or multiple recurring transactions by IDs with implicit two-step confirmation
   * 
   * BEHAVIOR:
   * - First call: Creates pending disable state, returns summaries + requiresConfirmation
   * - Second call (same IDs, within time window): Executes soft delete, returns deactivatedCount
   * - If window expired: Restarts confirmation process
   * 
   * @param userId User ID
   * @param ids Array of recurring transaction IDs to disable
   * @returns ServiceResult with either summaries (pending) or deactivatedCount (executed)
   */
  async disable(
    userId: string,
    ids: string[]
  ): Promise<ServiceResult<{ deactivatedCount?: number; summaries?: any[]; requiresConfirmation?: boolean }>> {
    // Validate IDs array
    if (!ids || ids.length === 0) {
      return failure(
        'No recurring transaction IDs provided',
        'VALIDATION_ERROR',
        'Please provide at least one recurring transaction ID to disable.'
      );
    }
    
    try {
      // Check if there's a pending disable for these exact params
      const pendingState = this.deletionStateService.checkPendingState(
        userId,
        'disableRecurringTransactions',
        ids
      );

      // CASE 1: Pending state exists and is valid → EXECUTE DISABLE
      if (pendingState.state === 'PENDING_VALID') {
        console.log(`[RecurringTransactionCommandService] Confirmed disabling for user ${userId}, executing...`);
        
        // Clear pending state
        this.deletionStateService.clearPendingState(userId, 'disableRecurringTransactions', ids);
        
        // Execute soft delete - set isActive = false
        const result = await this.prisma.recurringTransaction.updateMany({
          where: {
            id: { in: ids },
            userId,  // Extra safety
            isActive: true  // Only update active ones
          },
          data: {
            isActive: false
          }
        });

        console.log(`Deactivated ${result.count} recurring transaction(s) for user ${userId}`);

        // Build success message
        const message = result.count === 1 
          ? 'Deactivated 1 recurring transaction'
          : `Deactivated ${result.count} recurring transactions`;

        return success(
          { deactivatedCount: result.count },
          message
        );
      }

      // CASE 2: Pending state expired → Clear and fall through to create new
      if (pendingState.state === 'PENDING_EXPIRED') {
        console.log(`[RecurringTransactionCommandService] Pending disable expired for user ${userId}, clearing...`);
        this.deletionStateService.clearPendingState(userId, 'disableRecurringTransactions', ids);
        // Fall through to CASE 3
      }

      // CASE 3: No pending state (or expired) → CREATE PENDING STATE, RETURN SUMMARIES
      console.log(`[RecurringTransactionCommandService] Creating pending disable for user ${userId}...`);

      // Step 1: Fetch all recurring transactions matching IDs, userId, and active status
      const recurringTransactions = await this.prisma.recurringTransaction.findMany({
        where: {
          id: { in: ids },
          userId,
          isActive: true
        },
        select: { 
          id: true,
          amount: true,
          category: true,
          description: true,
          type: true,
          frequency: true,
          interval: true,
          dayOfWeek: true,
          dayOfMonth: true,
          monthOfYear: true,
          nextDue: true,
          isActive: true
        }
      });

      // Step 2: Check if all requested IDs were found
      const foundIds = recurringTransactions.map(rt => rt.id);
      const missingIds = ids.filter(id => !foundIds.includes(id));

      // Step 3: If any missing, return failure (all-or-nothing)
      if (missingIds.length > 0) {
        return failure(
          `Recurring transactions not found, unauthorized, or already inactive: ${missingIds.join(', ')}`,
          'NOT_FOUND',
          'Some recurring transactions do not exist, are already inactive, or you do not have access to them.'
        );
      }

      // Step 4: Create summaries for display
      const summaries = recurringTransactions.map(rt => ({
        id: rt.id,
        amount: rt.amount,
        category: rt.category,
        description: rt.description,
        type: rt.type as TransactionType,
        frequency: rt.frequency,
        interval: rt.interval,
        dayOfWeek: rt.dayOfWeek,
        dayOfMonth: rt.dayOfMonth,
        monthOfYear: rt.monthOfYear,
        nextDue: rt.nextDue,
        isActive: rt.isActive
      }));

      // Step 5: Store pending state
      this.deletionStateService.createPendingState(
        userId,
        'disableRecurringTransactions',
        ids,
        summaries
      );

      const message = recurringTransactions.length === 1
        ? 'Found 1 recurring transaction to disable. Please confirm.'
        : `Found ${recurringTransactions.length} recurring transactions to disable. Please confirm.`;

      return success(
        {
          summaries,
          requiresConfirmation: true
        },
        message
      );
    } catch (error) {
      return handleDatabaseError(error, 'disabling recurring transaction(s)');
    }
  }

  /**
   * Private method to perform the actual update logic
   * Shared by updateById and updateLast
   */
  private async update(
    id: string,
    updates: RecurringTransactionUpdateData,
    existingData: RecurringTransactionData
  ): Promise<RecurringTransactionResult> {
    try {
      // Build and validate update data
      const buildResult = this.buildRecurringTransactionUpdateData(updates, existingData);
      
      if (buildResult.result) {
        return buildResult.result; // Validation error
      }

      const { updateData, warnings: validationWarnings, needsRecalculation } = buildResult;
      const finalType = (updates.type || existingData.type) as TransactionType;

      // Perform the update
      const updatedRecurringTransaction = await this.prisma.recurringTransaction.update({
        where: { id },
        data: updateData,
      });

      console.log(`Recurring transaction updated: ID ${id}, changes:`, updateData);

      // Update the embedding
      await this.syncService.updateEmbedding(id, {
        id: updatedRecurringTransaction.id,
        description: updatedRecurringTransaction.description,
        type: updatedRecurringTransaction.type as TransactionType,
        amount: updatedRecurringTransaction.amount,
        category: updatedRecurringTransaction.category,
        nextDue: updatedRecurringTransaction.nextDue,
      }, updatedRecurringTransaction.userId);

      // Build success message
      const message = `Recurring ${finalType} updated successfully: $${updatedRecurringTransaction.amount} for ${updatedRecurringTransaction.category}${needsRecalculation ? ' (schedule recalculated)' : ''}`;

      return success(
        {
          id: updatedRecurringTransaction.id,
          amount: updatedRecurringTransaction.amount,
          category: updatedRecurringTransaction.category,
          description: updatedRecurringTransaction.description,
          frequency: updatedRecurringTransaction.frequency,
          interval: updatedRecurringTransaction.interval,
          dayOfWeek: updatedRecurringTransaction.dayOfWeek,
          dayOfMonth: updatedRecurringTransaction.dayOfMonth,
          monthOfYear: updatedRecurringTransaction.monthOfYear,
          nextDue: updatedRecurringTransaction.nextDue,
          type: updatedRecurringTransaction.type as TransactionType,
        },
        message,
        validationWarnings.length > 0 ? validationWarnings : undefined
      );
    } catch (error) {
      return handleDatabaseError(error, 'updating the recurring transaction');
    }
  }

  /**
   * Build update data for recurring transaction with validation
   * Delegates to base function for basic fields, handles recurrence-specific fields
   */
  private buildRecurringTransactionUpdateData(
    updates: RecurringTransactionUpdateData,
    existingData: RecurringTransactionData
  ): { result?: RecurringTransactionResult; updateData?: any; warnings: string[]; needsRecalculation: boolean; originalCategory?: string } {
    const updateData: any = {};
    let needsRecalculation = false;

    // Use pure function to handle basic fields validation (amount, category, description, type)
    const basicUpdateResult = buildBasicUpdateData(
      updates,
      existingData
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
        needsRecalculation: false,
      };
    }

    // Merge basic update data
    Object.assign(updateData, basicUpdateResult.updateData);

    // Handle recurrence-specific fields (frequency, interval, dayOfWeek, dayOfMonth, monthOfYear)
    if (updates.frequency !== undefined || updates.interval !== undefined || 
        updates.dayOfWeek !== undefined || updates.dayOfMonth !== undefined ||
        updates.monthOfYear !== undefined) {
      
      needsRecalculation = true;
      
      // Build complete recurrence data for validation
      const frequency = updates.frequency || existingData.frequency;
      const interval = updates.interval !== undefined ? updates.interval : existingData.interval;
      const dayOfWeek = updates.dayOfWeek !== undefined ? updates.dayOfWeek : existingData.dayOfWeek;
      const dayOfMonth = updates.dayOfMonth !== undefined ? updates.dayOfMonth : existingData.dayOfMonth;
      const monthOfYear = updates.monthOfYear !== undefined ? updates.monthOfYear : existingData.monthOfYear;
      
      // Validate the new recurrence pattern
      const finalType = (updates.type || existingData.type) as TransactionType;
      const mergedAmount = updates.amount !== undefined ? updates.amount : existingData.amount;
      
      const recurrenceValidation = this.recurrencePatternService.validate(
        mergedAmount,
        frequency,
        finalType,
        interval,
        dayOfWeek,
        dayOfMonth,
        monthOfYear
      );

      if (!recurrenceValidation.isValid) {
        return {
          result: failure(
            'Validation failed',
            'VALIDATION_ERROR',
            recurrenceValidation.errors!.join('; '),
            recurrenceValidation.errors
          ),
          warnings: [],
          needsRecalculation: false,
        };
      }

      updateData.frequency = frequency;
      updateData.interval = interval !== null ? interval : undefined;
      updateData.dayOfWeek = dayOfWeek !== null ? dayOfWeek : undefined;
      updateData.dayOfMonth = dayOfMonth !== null ? dayOfMonth : undefined;
      updateData.monthOfYear = monthOfYear !== null ? monthOfYear : undefined;
      updateData.nextDue = recurrenceValidation.nextDue;
    }

    return {
      updateData,
      warnings: basicUpdateResult.warnings,
      needsRecalculation,
      originalCategory: basicUpdateResult.originalCategory,
    };
  }
}
