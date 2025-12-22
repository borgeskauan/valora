import { QdrantClient } from "@qdrant/js-client-rest";

const VECTOR_SIZE = 3072;

export type Payload = {
  description: string;
  metadata?: Record<string, unknown> | null;
};

export type SearchHit = {
  id: string;
  score?: number;
  payload?: Payload | Record<string, unknown>;
};

function isAlreadyExists(err: unknown) {
  const msg =
    (err as any)?.data?.status?.error ??
    (err as any)?.message ??
    String(err ?? "");
  return /already exists|exists|collection.*exists|index.*exists/i.test(
    String(msg)
  );
}

export class QdrantService {
  public client: QdrantClient;

  constructor(url?: string) {
    this.client = new QdrantClient({
      url: url ?? process.env.QDRANT_URL ?? "http://localhost:6333",
    });
  }

  private async ensureCollection(collectionName: string): Promise<void> {
    try {
      await this.client.createCollection(collectionName, {
        vectors: { size: VECTOR_SIZE, distance: "Cosine" },
      });
    } catch (err) {
      if (!isAlreadyExists(err)) throw err;
    }
  }

  /**
   * Ensure an index on payload.metadata.transactionId for fast exact matches.
   * Use "keyword" for exact equality (case-sensitive).
   */
  private async ensureTransactionIdIndex(collectionName: string): Promise<void> {
    try {
      await this.client.createPayloadIndex(collectionName, {
        field_name: "metadata.transactionId",
        field_schema: "keyword",
      });
    } catch (err) {
      if (!isAlreadyExists(err)) throw err;
    }
  }

  /**
   * Ensure an index on payload.metadata.userId for fast user filtering.
   * Use "keyword" for exact equality (case-sensitive).
   */
  private async ensureUserIdIndex(collectionName: string): Promise<void> {
    try {
      await this.client.createPayloadIndex(collectionName, {
        field_name: "metadata.userId",
        field_schema: "keyword",
      });
    } catch (err) {
      if (!isAlreadyExists(err)) throw err;
    }
  }

  // TODO: Move this to docker-compose.yml (with proper volume for persistence)
  async ensureCollectionWithIndexes(collectionName: string): Promise<void> {
    await this.ensureCollection(collectionName);
    await this.ensureTransactionIdIndex(collectionName);
    await this.ensureUserIdIndex(collectionName);
  }

  async upsertPoint(
    collectionName: string,
    id: string,
    vector: number[],
    payload: Payload
  ): Promise<void> {
    await this.client.upsert(collectionName, {
      points: [
        {
          id,
          vector,
          payload,
        },
      ],
    });
  }

  async queryVector(collectionName: string, vector: number[], limit = 5, filter?: Record<string, any>): Promise<SearchHit[]> {
    const res = await this.client.search(collectionName, {
      vector,
      limit,
      withPayload: true,
      filter,
    } as any);

    const hits: SearchHit[] = (res as any[]).map((h: any) => ({
      id: h.id,
      score: h.score,
      payload: h.payload,
    }));
    return hits;
  }

  async findPointByKey(collectionName: string, key: string, value: string): Promise<SearchHit | null> {
    if (!key || typeof key !== "string") {
      throw new TypeError("key must be a non-empty string");
    }
    if (!value || typeof value !== "string") {
      throw new TypeError("value must be a non-empty string");
    }

    const response = await this.client.scroll(collectionName, {
      filter: {
        must: [{ key: `metadata.${key}`, match: { value } }],
      },
      limit: 1,
    });

    const points = (response as any).points ?? [];
    if (!Array.isArray(points) || points.length === 0) {
      return null;
    }

    const p = points[0];
    return {
      id: p.id,
      payload: p.payload as Payload,
    };
  }

  /**
   * List all collections in Qdrant
   */
  async listCollections(): Promise<string[]> {
    const response = await this.client.getCollections();
    return response.collections.map((c) => c.name);
  }

  /**
   * Create a collection with specified vector dimension
   */
  async createCollection(collectionName: string, vectorSize: number): Promise<void> {
    try {
      await this.client.createCollection(collectionName, {
        vectors: { size: vectorSize, distance: "Cosine" },
      });
    } catch (err) {
      if (!isAlreadyExists(err)) throw err;
    }
  }

  /**
   * Batch upsert multiple points to a collection
   */
  async upsertBatch(
    collectionName: string,
    points: Array<{ id: number; vector: number[]; payload: Record<string, any> }>
  ): Promise<void> {
    await this.client.upsert(collectionName, {
      points,
    });
  }

  /**
   * Search for similar vectors in a collection
   */
  async search(
    collectionName: string,
    vector: number[],
    limit: number
  ): Promise<Array<{ id: number; score: number; payload: Record<string, any> }>> {
    const res = await this.client.search(collectionName, {
      vector,
      limit,
      withPayload: true,
    } as any);

    return (res as any[]).map((h: any) => ({
      id: h.id,
      score: h.score,
      payload: h.payload,
    }));
  }
}
