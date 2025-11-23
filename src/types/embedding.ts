import { TransactionType } from '../config/transactionTypes';
import { TransactionData } from './models';

/**
 * Input for embedding a transaction
 */
export interface TransactionEmbeddingInput {
  id: string;
  description: string | null;
  type: TransactionType;
  kind: 'onetime' | 'recurring';
  amount: number;  // For synthetic description
  category: string; // For synthetic description
  date: string;     // For synthetic description (recurring uses startDate)
  userId: string;   // For user-scoped filtering
}

/**
 * Metadata stored in Qdrant
 */
export interface TransactionEmbeddingMetadata {
  transactionId: string;  // Prefixed: "T-123" or "RT-456"
  transactionKind: 'onetime' | 'recurring';
  transactionType: TransactionType;
  userId: string;         // For user-scoped filtering
}

/**
 * Return type for embed/update operations
 */
export interface EmbeddingOperationResult {
  embeddingId: string;
  transactionId: string;
}

/**
 * Lightweight search match returned by embedding service
 * Caller is responsible for fetching full transaction data if needed
 */
export interface TransactionSearchMatch {
  id: string;
  kind: 'onetime' | 'recurring';
  score: number;
}
