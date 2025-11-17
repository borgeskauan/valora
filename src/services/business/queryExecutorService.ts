import { PrismaClient } from '../../generated/prisma';
import { PrismaClientManager } from '../../lib/PrismaClientManager';
import { UserContextProvider } from '../../lib/UserContextProvider';
import { QueryResult, QueryResultData, QueryResultServiceResult } from '../../types/models';
import { success, failure } from '../../types/ServiceResult';

const ALLOWED_TABLES = ["Transaction", "RecurringTransaction"];
// Accept table names with or without quotes (", ', or `)
const ALLOWED_TABLES_RE = ALLOWED_TABLES.map(t => `["'\`]?${t}["'\`]?`).join("|");

// Dangerous SQL keywords to block
const DANGEROUS_KEYWORDS = /\b(DELETE|UPDATE|INSERT|DROP|ALTER|CREATE|TRUNCATE|EXEC|EXECUTE|PRAGMA)\b/i;

// Basic SELECT pattern
const SELECT_PATTERN = /^\s*SELECT\b/i;

// Pattern to match LIMIT clause
const LIMIT_PATTERN = /LIMIT\s+\d+/i;

// Base SQL regex - ensures SELECT from allowed tables with userId filter
const SQL_REGEX = new RegExp(
  `^\\s*SELECT\\s+[\\s\\S]+\\s+FROM\\s+(${ALLOWED_TABLES_RE})\\b[\\s\\S]*WHERE\\s+[\\s\\S]*userId\\s*=\\s*[\\s\\S]*`,
  "i"
);

export class QueryExecutorService {
  private prisma: PrismaClient;
  private userContext?: UserContextProvider;

  constructor(userContext?: UserContextProvider) {
    this.prisma = PrismaClientManager.getClient();
    this.userContext = userContext;
  }

  /**
   * Execute a user-provided SQL query with validation
   * @param sqlQuery - The SQL query to execute (with {USER_ID_PLACEHOLDER})
   * @param queryDescription - Human-readable description for logging
   * @returns ServiceResult with query results or validation error
   */
  async executeQuery(
    sqlQuery: string,
    queryDescription: string
  ): Promise<QueryResultServiceResult> {
    // Get userId from context
    const userId = this.userContext?.getUserId() || '1';
    
    console.log(`[QueryExecutor] Executing query: ${queryDescription}`);
    console.log(`[QueryExecutor] SQL: ${sqlQuery}`);
    console.log(`[QueryExecutor] UserId: ${userId}`);

    // Validate the query structure
    const validationResult = this.validateQuery(sqlQuery);
    if (!validationResult.success) {
      console.log(`[QueryExecutor] Validation failed: ${validationResult.reason}`);
      return failure(
        validationResult.reason,
        'VALIDATION_ERROR',
        `Query validation failed: ${validationResult.reason}`
      );
    }

    // Inject userId safely
    let finalSql = this.injectUserId(validationResult.sql, userId);
    
    // Quote table names for SQLite compatibility
    finalSql = this.quoteTableNames(finalSql);
    
    console.log(`[QueryExecutor] Final SQL: ${finalSql}`);

    // Execute the query
    try {
      // MongoDB doesn't support raw SQL queries - this needs to be reimplemented
      // const rawResults = await this.prisma.$queryRawUnsafe(finalSql);
      console.log(`[QueryExecutor] MongoDB does not support raw SQL queries. Query execution disabled.`);
      
      return failure(
        'Query execution not supported',
        'UNSUPPORTED_OPERATION',
        'Raw SQL queries are not supported with MongoDB. This functionality needs to be reimplemented.'
      );
    } catch (error: any) {
      console.error('[QueryExecutor] Query execution error:', error);
      return failure(
        'Failed to execute query',
        'DATABASE_ERROR',
        error.message || 'An error occurred while executing the query'
      );
    }
  }

  /**
   * Validate SQL query structure with regex
   * @param sql - The SQL query to validate
   * @returns Validation result with processed SQL or error reason
   */
  private validateQuery(sql: string): { success: true; sql: string } | { success: false; reason: string } {
    let trimmed = sql.trim();

    // Block multiple statements
    const statements = trimmed.split(';').filter(s => s.trim().length > 0);
    if (statements.length > 1) {
      return { success: false, reason: "Multiple statements are not allowed" };
    }

    // Must be a SELECT statement
    if (!SELECT_PATTERN.test(trimmed)) {
      return { success: false, reason: "Only SELECT queries are allowed" };
    }

    // Block dangerous keywords
    if (DANGEROUS_KEYWORDS.test(trimmed)) {
      return { success: false, reason: "Query contains forbidden SQL keywords (DELETE, UPDATE, INSERT, DROP, etc.)" };
    }

    // Must include userId placeholder
    if (!trimmed.includes('{USER_ID_PLACEHOLDER}')) {
      return {
        success: false,
        reason: "Query must include WHERE userId = '{USER_ID_PLACEHOLDER}' filter"
      };
    }

    // Add LIMIT clause if missing (enforce max 100 rows)
    if (!LIMIT_PATTERN.test(trimmed)) {
      trimmed = trimmed.replace(/;?\s*$/, ' LIMIT 100');
      console.log('[QueryExecutor] Auto-added LIMIT 100 to query');
    }

    // Validate against base regex pattern
    // After placeholder replacement, it should match our pattern
    const testSql = trimmed.replace(/{USER_ID_PLACEHOLDER}/g, "'test-user-id'");
    if (!SQL_REGEX.test(testSql)) {
      return {
        success: false,
        reason: `Query must match pattern: SELECT ... FROM ${ALLOWED_TABLES.join(" or ")} WHERE ... userId = ...`
      };
    }

    return { success: true, sql: trimmed };
  }

  /**
   * Safely inject userId into SQL query
   * @param sql - The validated SQL query with placeholder
   * @param userId - The user ID to inject
   * @returns SQL query with userId injected
   */
  private injectUserId(sql: string, userId: string): string {
    // Sanitize userId - whitelist alphanumeric, hyphens, underscores, @, and .
    const safeUserId = userId.replace(/[^a-zA-Z0-9-_@.]/g, '');
    
    if (safeUserId !== userId) {
      console.warn('[QueryExecutor] userId was sanitized:', { original: userId, sanitized: safeUserId });
    }

    // Handle both quoted and unquoted placeholder patterns
    // Case 1: Placeholder with quotes: userId = '{USER_ID_PLACEHOLDER}' or userId = "{USER_ID_PLACEHOLDER}"
    // Replace including the quotes
    let result = sql.replace(/['"]?\{USER_ID_PLACEHOLDER\}['"]?/g, `'${safeUserId}'`);
    
    return result;
  }

  /**
   * Quote table names in SQL for SQLite compatibility
   * SQLite requires quoting for case-sensitive table names
   * @param sql - The SQL query to process
   * @returns SQL with table names quoted
   */
  private quoteTableNames(sql: string): string {
    let processedSql = sql;
    
    for (const table of ALLOWED_TABLES) {
      // Match table name that's NOT already quoted
      // Use word boundaries and negative lookahead/lookbehind to avoid double-quoting
      // Matches: Transaction but not "Transaction" or 'Transaction'
      const unquotedPattern = new RegExp(`(?<!['"\\w])\\b${table}\\b(?!['"\\w])`, 'g');
      
      // Replace with double-quoted version
      processedSql = processedSql.replace(unquotedPattern, `"${table}"`);
    }
    
    return processedSql;
  }
}
