// MongoConnectionManager.ts
import { MongoClient, Db, Collection } from "mongodb";
import {
  TransactionDoc,
  RecurringTransactionDoc,
} from "./schemas";
import { config } from "../../../config";

export interface MongoConnectionManagerOptions {
  uri: string;
  /**
   * Optional explicit database name.
   * If omitted, the driver will use the database from the URI
   * (or fall back to "test" if none is specified).
   */
  dbName?: string;
}

/**
 * Thin wrapper around MongoClient that:
 * - Lazily connects on first use
 * - Caches the client and Db
 * - Exposes typed collections for Transaction and RecurringTransaction
 */
export class MongoConnectionManager {
  private client: MongoClient | null = null;
  private db: Db | null = null;

  private readonly uri: string;
  private readonly dbName?: string;

  constructor(options: MongoConnectionManagerOptions) {
    if (!options.uri) {
      throw new Error("MongoConnectionManager: uri is required");
    }

    this.uri = options.uri;
    this.dbName = options.dbName;
  }

  /**
   * Convenience factory that reads from environment variables:
   * - DATABASE_URL
   *
   * Assumes the database name is included in the connection string,
   * e.g. mongodb+srv://user:pass@host/mydb?...
   */
  static fromEnv(): MongoConnectionManager {
    const uri = config.databaseUrl;

    if (!uri) {
      throw new Error("MongoConnectionManager.fromEnv: DATABASE_URL is not set");
    }

    return new MongoConnectionManager({ uri });
  }

  /**
   * Ensure we have a connected MongoClient.
   * Connection is created lazily and reused afterwards.
   *
   * In modern drivers, calling `connect()` multiple times is safe:
   * it will reuse the underlying pool rather than opening new ones.
   */
  private async getClient(): Promise<MongoClient> {
    if (!this.client) {
      this.client = new MongoClient(this.uri);
    }

    // Idempotent; if already connected it's a cheap no-op.
    await this.client.connect();

    return this.client;
  }

  /**
   * Ensure we have a Db instance.
   * If dbName was provided, use that; otherwise rely on the database
   * encoded in the connection string (or driver's default).
   */
  private async getDb(): Promise<Db> {
    if (this.db) {
      return this.db;
    }

    const client = await this.getClient();
    this.db = this.dbName ? client.db(this.dbName) : client.db();
    return this.db;
  }

  /**
   * Get the Transaction collection.
   *
   * Prisma Mongo default uses the model name as collection:
   * - model Transaction → "Transaction"
   * If you changed it via @@map, update the name here.
   */
  async getTransactionCollection(): Promise<Collection<TransactionDoc>> {
    const db = await this.getDb();
    return db.collection<TransactionDoc>("Transaction");
  }

  /**
   * Get the RecurringTransaction collection.
   */
  async getRecurringTransactionCollection(): Promise<
    Collection<RecurringTransactionDoc>
  > {
    const db = await this.getDb();
    return db.collection<RecurringTransactionDoc>("RecurringTransaction");
  }

  /**
   * Optional: close the underlying MongoClient connection.
   * Call this on app shutdown if you need a clean exit.
   */
  async close(): Promise<void> {
    if (this.client) {
      await this.client.close();
      this.client = null;
      this.db = null;
    }
  }
}
