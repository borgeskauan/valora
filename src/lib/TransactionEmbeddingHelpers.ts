import { TransactionType } from '../config/transactionTypes';
import { TransactionEmbeddingInput, TransactionEmbeddingMetadata } from '../types/embedding';

/**
 * Static utility class for transaction embedding helper functions
 * Extracted from TransactionEmbeddingService to improve maintainability
 */
export class TransactionEmbeddingHelpers {
  /**
   * Generate description from transaction data
   * If description exists, use it; otherwise generate synthetic description
   */
  static generateDescription(input: TransactionEmbeddingInput): string {
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
   * Stores plain transaction ID (no prefix) - collection determines kind
   */
  static buildMetadata(
    transactionId: string,
    type: TransactionType,
    userId: string
  ): TransactionEmbeddingMetadata {
    return {
      transactionId,
      transactionType: type,
      userId,
    };
  }
}
