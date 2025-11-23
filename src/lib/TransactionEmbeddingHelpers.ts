import { TransactionType } from '../config/transactionTypes';
import { TransactionEmbeddingInput, TransactionEmbeddingMetadata } from '../types/embedding';

/**
 * Static utility class for transaction embedding helper functions
 * Extracted from TransactionEmbeddingService to improve maintainability
 */
export class TransactionEmbeddingHelpers {
  /**
   * Build prefixed transaction ID for Qdrant storage
   * Format: "T-{id}" for one-time transactions, "RT-{id}" for recurring
   */
  static buildPrefixedId(id: string, kind: string): string {
    return kind === 'recurring' ? `RT-${id}` : `T-${id}`;
  }

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
   */
  static buildMetadata(
    transactionId: string,
    type: TransactionType,
    kind: string,
    userId: string
  ): TransactionEmbeddingMetadata {
    return {
      transactionId,
      transactionKind: kind as 'onetime' | 'recurring',
      transactionType: type,
      userId,
    };
  }

  /**
   * Parse embedding hits and extract transaction IDs grouped by kind
   * Returns separated arrays of one-time and recurring transaction IDs
   * along with a score map for relevance ranking
   */
  static parseEmbeddingHits(hits: any[]): {
    onetimeIds: string[];
    recurringIds: string[];
    scoreMap: Map<string, number>;
  } {
    const onetimeIds: string[] = [];
    const recurringIds: string[] = [];
    const scoreMap = new Map<string, number>();

    for (const hit of hits) {
      const metadata = hit.payload?.metadata as TransactionEmbeddingMetadata;
      if (!metadata || !metadata.transactionId) continue;

      scoreMap.set(metadata.transactionId, hit.score ?? 0);

      if (metadata.transactionId.startsWith('T-')) {
        const id = metadata.transactionId.substring(2);
        if (id) onetimeIds.push(id);
      } else if (metadata.transactionId.startsWith('RT-')) {
        const id = metadata.transactionId.substring(3);
        if (id) recurringIds.push(id);
      }
    }

    return { onetimeIds, recurringIds, scoreMap };
  }
}
