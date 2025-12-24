# Refactor Report: Expense Tracker Bot

**Generated:** 2024-12-24  
**Repository:** borgeskauan/expense-tracker-bot  
**Branch:** main  
**Overall Risk:** 🟡 MEDIUM  

---

## Executive Summary

This WhatsApp-based financial tracking bot uses Google Gemini AI for natural language processing and follows a **function calling pipeline architecture**. The codebase demonstrates good architectural patterns (composition, ServiceResult, domain objects) but suffers from:

1. **Excessive `any` types** undermining TypeScript safety
2. **Heavy code duplication** across business services  
3. **No test coverage** despite complex business logic
4. **500+ line service files** with mixed responsibilities
5. **Console.log overuse** instead of structured logging
6. **Singleton anti-pattern** creating tight coupling
7. **Security vulnerability** in dependency (high severity)

**Good Practices Observed:**
- Strict TypeScript configuration
- ServiceResult pattern for standardized responses
- Pure function utilities for validation
- Composition over inheritance
- No circular dependencies
- Repository pattern (partially implemented)

**Priority:** Focus on type safety, testing infrastructure, and service decomposition before adding new features.

---

## 1. Architecture Snapshot

### System Overview

```
WhatsApp → Controller → AIMessageService (orchestrator)
                            ↓
                       GeminiService (LLM)
                            ↓
               FunctionDeclarationService (executor)
                            ↓
               Business Services (Transaction/Recurring/Category)
                            ↓
        Infrastructure (Prisma/MongoDB, Qdrant, Conversation)
```

### Module Layers

| Layer | Components | Responsibility |
|-------|------------|----------------|
| **Entry** | `index.ts`, `whatsapp.ts` (routes) | Server bootstrap, Express routing |
| **Controller** | `WhatsAppController` | Webhook handling, orchestration |
| **AI Orchestration** | `AIMessageService`, `GeminiService` | Iterative function calling loop (max 50 iterations) |
| **AI Function Mapping** | `FunctionDeclarationService` | Maps LLM function calls → service methods |
| **Business Logic** | `TransactionService`, `RecurringTransactionService`, `CategoryClassificationService`, `TransactionLookupService` | Core domain operations (CRUD + AI classification) |
| **Infrastructure** | `ConversationService`, `WhatsAppService`, `DeletionStateService`, `MongoConnectionManager`, `MqlTransactionSearchService` | Persistence, external APIs, state management |
| **Embedding/Search** | `TransactionEmbeddingService`, `QdrantService`, `Embedder`, `FreeformTransactionSearchService` | Semantic search via vector DB |
| **Domain** | `RecurrencePattern` | Business logic encapsulation |
| **Utilities** | `CategoryNormalizer`, `DateNormalizer`, `MessageBuilder`, `PrismaClientManager`, validators | Shared pure functions |

### Boundary Violations

1. **Prisma client in services** - `PrismaClientManager` pattern is good, but services directly use Prisma instead of repositories (partial pattern adoption)
2. **Validation scattered** - Some in validators, some in `transactionValidation.ts`, some inline
3. **Category logic split** - `CategoryNormalizer` (lib) vs `CategoryClassificationService` (business)
4. **Embedding concerns mixed** - `TransactionEmbeddingService` both orchestrates and calls Qdrant directly

---

## 2. Prioritized Refactoring Opportunities

### 🔴 **CRITICAL** (Security & Stability)

#### **F1: Security Vulnerability in `jws` Dependency**

**Evidence:**
```
jws  4.0.0
Severity: high
auth0/node-jws Improperly Verifies HMAC Signature - GHSA-869p-cjfg-cm3x
```

**Problem:** High severity vulnerability in transitive dependency could allow HMAC signature bypass.

**Recommendation:**
```bash
npm audit fix
# If fails, investigate with:
npm audit fix --force
# Or update parent dependencies
```

**Scope:** 1 file (package-lock.json)  
**Tests:** Run existing build, verify no breaking changes  
**Acceptance:** `npm audit` shows 0 vulnerabilities  
**Rollback:** Revert package-lock.json  
**PR:** Standalone security fix

---

#### **F2: Eliminate `any` Type Usage (21+ instances)**

**Evidence:**
```typescript
// src/services/dependencyService.ts:21
private services: Map<string, any> = new Map();

// src/services/ai/functionDeclarationService.ts:147
async executeFunction(functionName: string, userId: string, parameters: any): Promise<any>

// src/services/ai/embedding/QdrantService.ts:99
async queryVector(..., filter?: Record<string, any>): Promise<SearchHit[]>

// src/lib/transactionValidation.ts:29
updateData?: any;

// src/types/ai.ts:19
args: any;
```

**Problem:** 
- TypeScript safety bypassed in core paths
- Runtime errors not caught at compile time
- Refactoring breaks not detected
- AI function parameter validation lost

**Recommendation:** Replace with proper types in phases:

**Phase 1: Service Registry (DependencyService)**
```typescript
// Define service interface map
type ServiceRegistry = {
  transactionService: TransactionService;
  recurringTransactionService: RecurringTransactionService;
  categoryClassifier: CategoryClassificationService;
  // ... etc
};

class DependencyService {
  private services: Partial<ServiceRegistry> = {};
  
  get transactionService(): TransactionService {
    return this.services.transactionService!;
  }
  // Typed getters for each service
}
```

**Phase 2: Function Parameters (FunctionDeclarationService)**
```typescript
// Define discriminated union for all function params
type FunctionParams = 
  | { type: 'addTransaction'; transactionData: Transaction }
  | { type: 'createRecurringTransaction'; recurringTransactionData: RecurringTransactionInput }
  | { type: 'editTransactionById'; id: string; updates: TransactionUpdateData }
  // ... etc

async executeFunction<T extends FunctionParams['type']>(
  functionName: T,
  userId: string,
  parameters: Extract<FunctionParams, { type: T }>
): Promise<ServiceResult<unknown>>
```

**Phase 3: Qdrant & Embedding**
```typescript
// Replace generic Record<string, any> with specific types
interface QdrantFilter {
  must?: QdrantCondition[];
  should?: QdrantCondition[];
  must_not?: QdrantCondition[];
}

type QdrantCondition = {
  key: string;
  match: { value: string | number | boolean };
};
```

**Scope:** ~25 files  
**Tests:** Unit tests for each typed function signature  
**Acceptance:** `grep -r "any" src/ --exclude-dir=generated` returns only justified cases (with `// @ts-expect-error` comments)  
**Rollback:** Revert per phase  
**PR:** 3 PRs (one per phase)

---

### 🟠 **HIGH** (Maintainability & Testing)

#### **F3: Establish Testing Infrastructure (0% coverage)**

**Evidence:**
```json
// package.json:10
"test": "echo \"Error: no test specified\" && exit 1"
```

**Problem:** 
- 583-line `RecurringTransactionService` has no tests
- Complex date calculation logic (`RecurrencePattern.calculateNextDueDate()`) untested
- AI function mapping untested
- Pure validators/normalizers (easiest to test) have no coverage

**Recommendation:** Adopt **Jest** with tiered testing strategy:

**Step 1: Install & Configure**
```bash
npm install --save-dev jest ts-jest @types/jest
npx ts-jest config:init
```

```javascript
// jest.config.js
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/generated/**',
    '!src/index.ts'
  ],
  coverageThresholds: {
    global: {
      branches: 60,
      functions: 70,
      lines: 75,
      statements: 75
    }
  }
};
```

**Step 2: Test Pure Functions First (Low Hanging Fruit)**
```typescript
// src/validators/__tests__/TransactionValidator.test.ts
describe('TransactionValidator', () => {
  describe('validateAmount', () => {
    it('accepts positive numbers', () => {
      expect(TransactionValidator.validateAmount(10.5).isValid).toBe(true);
    });
    
    it('rejects negative amounts', () => {
      const result = TransactionValidator.validateAmount(-5);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Amount must be positive');
    });
  });
});

// src/lib/__tests__/CategoryNormalizer.test.ts
// src/domain/__tests__/RecurrencePattern.test.ts
```

**Step 3: Mock Prisma for Service Tests**
```typescript
// src/__mocks__/prismaClient.ts
export const mockPrismaClient = {
  transaction: {
    create: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
  },
  // ... etc
};

// src/services/business/__tests__/TransactionService.test.ts
jest.mock('../../lib/PrismaClientManager', () => ({
  PrismaClientManager: {
    getClient: () => mockPrismaClient
  }
}));
```

**Step 4: Integration Tests with Test DB**
```typescript
// src/__tests__/integration/transaction.integration.test.ts
beforeAll(async () => {
  process.env.DATABASE_URL = 'mongodb://localhost:27017/test_expense_tracker';
  await prisma.$connect();
});

afterAll(async () => {
  await prisma.$disconnect();
});
```

**Scope:** All 52 source files  
**Tests:** Tests test themselves (meta)  
**Acceptance:** 
- `npm test` runs without errors
- Coverage > 70% for validators, normalizers, RecurrencePattern
- At least 1 integration test for transaction creation flow
**Rollback:** Remove test files and jest config  
**PR:** 4 PRs (setup + pure functions + services + integration)

---

#### **F4: Break Up Monolithic Services (500+ lines)**

**Evidence:**
```
583 lines - src/services/business/RecurringTransactionService.ts
501 lines - src/services/business/CategoryClassificationService.ts
458 lines - src/services/business/TransactionService.ts
```

**Problem:**
- Multiple responsibilities per service (CRUD + validation + embedding + deletion state)
- Hard to test individual concerns
- Violates Single Responsibility Principle
- Shared validation logic duplicated (see F6)

**Recommendation:** Extract to focused services using **Vertical Slice Architecture**:

**RecurringTransactionService → 4 services**
```typescript
// src/services/business/recurring/RecurringTransactionCommandService.ts
class RecurringTransactionCommandService {
  async create(userId: string, data: RecurringTransactionInput): Promise<RecurringTransactionResult>
  async update(userId: string, id: string, updates: RecurringTransactionUpdateData): Promise<RecurringTransactionResult>
  async disable(userId: string, ids: string[]): Promise<ServiceResult<DisableResult>>
}

// src/services/business/recurring/RecurringTransactionQueryService.ts
class RecurringTransactionQueryService {
  async findById(userId: string, id: string): Promise<RecurringTransactionData | null>
  async findLastByUser(userId: string, type?: TransactionType): Promise<RecurringTransactionData | null>
}

// src/services/business/recurring/RecurrencePatternService.ts
class RecurrencePatternService {
  validate(amount, frequency, type, interval?, ...): ValidationResult
  calculateNextDue(pattern: RecurrencePattern): string
}

// src/services/business/recurring/RecurringTransactionSyncService.ts
class RecurringTransactionSyncService {
  async syncEmbedding(transaction: RecurringTransactionData): Promise<void>
  async updateEmbedding(id: string, updates: Partial<RecurringTransactionData>): Promise<void>
}
```

**TransactionService → 3 services**
```typescript
// src/services/business/transaction/TransactionCommandService.ts
class TransactionCommandService {
  async add(userId: string, data: Transaction): Promise<TransactionResult>
  async update(userId: string, id: string, updates: TransactionUpdateData): Promise<TransactionResult>
  async delete(userId: string, ids: string[]): Promise<ServiceResult<DeleteResult>>
}

// src/services/business/transaction/TransactionQueryService.ts
class TransactionQueryService {
  async findById(userId: string, id: string): Promise<TransactionData | null>
  async findLastByUser(userId: string, type?: TransactionType): Promise<TransactionData | null>
}

// src/services/business/transaction/TransactionSyncService.ts
class TransactionSyncService {
  async syncEmbedding(transaction: TransactionData): Promise<void>
  async deleteEmbedding(transactionId: string): Promise<void>
}
```

**CategoryClassificationService → 2 services**
```typescript
// src/services/business/category/CategoryClassificationService.ts (slim down to ~100 lines)
class CategoryClassificationService {
  async classifyCategory(description?, type, explicitCategory?): Promise<CategoryClassificationResult>
}

// src/services/business/category/CategoryExemplarSeeder.ts
class CategoryExemplarSeeder {
  async seedExpenseExemplars(): Promise<void>
  async seedIncomeExemplars(): Promise<void>
  private async seedCollection(collection, exemplars): Promise<void>
}
```

**Scope:** 3 large service files → 9 focused services  
**Tests:** Each new service gets unit tests (reuse existing test logic)  
**Acceptance:** 
- All services < 250 lines
- `npm run build` succeeds
- Existing function declarations still work (integration test)
**Rollback:** Git revert service extraction commits  
**PR:** 3 PRs (one per service family)

---

#### **F5: Replace Console.log with Structured Logging**

**Evidence:**
```bash
$ grep -r "console.log" src/ | wc -l
74
```

**Problem:**
- No log levels (info/warn/error/debug)
- Can't disable verbose logs in production
- No structured data for log aggregation
- Performance impact (string interpolation always runs)

**Recommendation:** Adopt **winston** for structured logging:

**Step 1: Install & Configure**
```bash
npm install winston
```

```typescript
// src/lib/logger.ts
import winston from 'winston';

const isDevelopment = process.env.NODE_ENV !== 'production';

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || (isDevelopment ? 'debug' : 'info'),
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    isDevelopment
      ? winston.format.combine(
          winston.format.colorize(),
          winston.format.printf(({ timestamp, level, message, ...meta }) => {
            return `${timestamp} [${level}]: ${message} ${Object.keys(meta).length ? JSON.stringify(meta, null, 2) : ''}`;
          })
        )
      : winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' }),
  ],
});
```

**Step 2: Replace Console.log**
```typescript
// Before
console.log(`Transaction added: $${transaction.amount} for ${transaction.category}`);

// After
logger.info('Transaction added', {
  amount: transaction.amount,
  category: transaction.category,
  userId: transaction.userId,
  transactionId: transaction.id
});
```

**Step 3: Add Context Loggers**
```typescript
// src/services/business/TransactionService.ts
private logger = logger.child({ service: 'TransactionService' });

// Logs automatically include service: 'TransactionService'
this.logger.debug('Validating transaction data', { userId, amount });
```

**Scope:** 52 files, ~74 console.log statements  
**Tests:** Unit test logger is called with correct levels/data  
**Acceptance:** 
- No `console.log` in src/ (except index.ts bootstrap)
- `LOG_LEVEL=error` suppresses debug logs
- Logs output JSON in production mode
**Rollback:** Revert logger.ts and console.log replacements  
**PR:** 1 PR (setup + bulk replacement)

---

### 🟡 **MEDIUM** (Code Quality)

#### **F6: Deduplicate Service Logic (6 major clones)**

**Evidence:** (from `jscpd` output)
```
1. RecurringTransactionService.ts [3:49 - 14:28] ↔ TransactionService.ts [2:28 - 13:19]
   - Duplicate imports and constructor setup

2. RecurringTransactionService.ts [14:2 - 37:6] ↔ TransactionService.ts [13:2 - 35:6]
   - Duplicate constructor injection pattern

3. RecurringTransactionService.ts [195:7 - 208:2] ↔ TransactionLookupService.ts [133:7 - 145:2]
   - Duplicate embedding sync logic

4. TransactionLookupService.ts [82:9 - 97:36] ↔ TransactionLookupService.ts [38:9 - 53:35]
   - Duplicate query building within same file

5. TransactionEmbeddingService.ts [85:27 - 96:34] ↔ [41:17 - 52:35]
   - Duplicate embedding metadata building

6. FreeformTransactionSearchService.ts [82:41 - 101:51] ↔ [36:32 - 55:41]
   - Duplicate result mapping
```

**Problem:**
- 6+ significant code clones (10-20 lines each)
- Changes must be made in multiple places
- Bug fixes may miss duplicate locations
- Increases maintenance burden

**Recommendation:** Extract shared logic to base classes or utility functions:

**Clone 1-2: Shared Service Constructor**
```typescript
// src/services/business/BaseTransactionService.ts
export abstract class BaseTransactionService {
  protected prisma: PrismaClient;
  protected lookupService: TransactionLookupService;
  protected embeddingService: TransactionEmbeddingService;
  protected categoryClassifier: CategoryClassificationService;
  protected deletionStateService: DeletionStateService;

  constructor(
    embeddingService: TransactionEmbeddingService,
    lookupService: TransactionLookupService,
    categoryClassifier: CategoryClassificationService,
    deletionStateService: DeletionStateService
  ) {
    this.prisma = PrismaClientManager.getClient();
    this.lookupService = lookupService;
    this.embeddingService = embeddingService;
    this.categoryClassifier = categoryClassifier;
    this.deletionStateService = deletionStateService;
  }
}

// Usage
export class TransactionService extends BaseTransactionService {
  async addTransaction(...) { ... }
}
```

**Clone 3: Shared Embedding Sync**
```typescript
// src/lib/TransactionEmbeddingHelpers.ts (already exists, consolidate here)
export async function syncTransactionEmbedding(
  embeddingService: TransactionEmbeddingService,
  transaction: TransactionData | RecurringTransactionData,
  kind: 'onetime' | 'recurring'
): Promise<void> {
  const result = await embeddingService.embedTransaction({
    id: transaction.id,
    description: transaction.description,
    type: transaction.type as TransactionType,
    kind,
    amount: transaction.amount,
    category: transaction.category,
    date: 'date' in transaction ? transaction.date : undefined,
    userId: transaction.userId,
  });

  if (!result.success) {
    console.error(`Failed to embed ${kind} transaction ${transaction.id}: ${result.message}`);
  }
}
```

**Clone 4-6: Extract Duplicate Logic in Same File**
```typescript
// FreeformTransactionSearchService.ts
private buildSearchFilter(userId: string, type?: TransactionType): QdrantFilter {
  const must: QdrantCondition[] = [{ key: 'metadata.userId', match: { value: userId } }];
  if (type) {
    must.push({ key: 'metadata.type', match: { value: type } });
  }
  return { must };
}

async searchTransactions(userId: string, query: string): Promise<SearchResult> {
  const filter = this.buildSearchFilter(userId); // Reuse
  // ... rest
}
```

**Scope:** 6 files  
**Tests:** Existing tests should still pass (regression)  
**Acceptance:** `npx jscpd src/ --min-lines 10` shows < 3 clones  
**Rollback:** Revert extraction commits  
**PR:** 2 PRs (base service + utility extractions)

---

#### **F7: Refactor Singleton Pattern to DI Container**

**Evidence:**
```typescript
// src/services/dependencyService.ts:20-30
export class DependencyService {
  private static instance: DependencyService;
  
  static getInstance(): DependencyService {
    if (!DependencyService.instance) {
      DependencyService.instance = new DependencyService();
    }
    return DependencyService.instance;
  }
}

// Also: PrismaClientManager, conversationService, whatsappService
```

**Problem:**
- Hard to test (can't inject mocks)
- Global mutable state
- Hidden dependencies (unclear what depends on what)
- Initialization order issues

**Recommendation:** Use **tsyringe** or **inversify** for IoC:

**Option A: tsyringe (simpler)**
```bash
npm install tsyringe reflect-metadata
```

```typescript
// src/di/container.ts
import 'reflect-metadata';
import { container } from 'tsyringe';
import { TransactionService } from '../services/business/TransactionService';
// ... import all services

// Register singletons
container.registerSingleton(PrismaClient, () => PrismaClientManager.getClient());
container.registerSingleton(TransactionService);
container.registerSingleton(RecurringTransactionService);
// ... etc

export { container };

// src/index.ts
import { container } from './di/container';

const app = express();
const whatsappController = container.resolve(WhatsAppController);
app.use('/whatsapp', whatsappController.getRouter());
```

**Option B: Manual Factory (zero deps)**
```typescript
// src/di/ServiceFactory.ts
export class ServiceFactory {
  private services: Map<string, any> = new Map();
  
  constructor() {
    this.initializeServices();
  }
  
  private initializeServices(): void {
    const prisma = PrismaClientManager.getClient();
    const embedder = new Embedder();
    const qdrant = new QdrantService();
    
    // Build dependency graph bottom-up
    const transactionLookup = new TransactionLookupService(prisma);
    const embeddingService = new TransactionEmbeddingService(embedder, qdrant, prisma);
    const categoryClassifier = new CategoryClassificationService(embedder, qdrant);
    const deletionState = new DeletionStateService(prisma);
    
    const transactionService = new TransactionService(
      embeddingService,
      transactionLookup,
      categoryClassifier,
      deletionState
    );
    
    this.services.set('transactionService', transactionService);
    // ... register all
  }
  
  get transactionService(): TransactionService {
    return this.services.get('transactionService')!;
  }
}
```

**Scope:** 5 files (DependencyService + 3 other singletons + index.ts)  
**Tests:** Mock injection in unit tests becomes trivial  
**Acceptance:** 
- `grep -r "getInstance" src/` returns 0 matches
- All services injected via constructor
**Rollback:** Revert to singleton pattern  
**PR:** 1 PR (DI refactor)

---

#### **F8: Add Repository Layer (Complete Pattern)**

**Evidence:**
```typescript
// src/services/business/TransactionService.ts:76
const transaction = await this.prisma.transaction.create({
  data: { userId, date, amount, category, description, type }
});

// No repository - services use Prisma directly
```

**Problem:**
- Business logic coupled to Prisma ORM
- Hard to swap persistence layer
- Can't easily mock DB in tests
- Repository pattern half-implemented (folder exists, but not used)

**Recommendation:** Create full repository abstraction:

```typescript
// src/services/repositories/ITransactionRepository.ts
export interface ITransactionRepository {
  create(data: CreateTransactionDto): Promise<TransactionData>;
  findById(id: string): Promise<TransactionData | null>;
  findMany(filter: TransactionFilter): Promise<TransactionData[]>;
  update(id: string, updates: Partial<TransactionData>): Promise<TransactionData>;
  delete(ids: string[]): Promise<{ count: number }>;
}

// src/services/repositories/PrismaTransactionRepository.ts
export class PrismaTransactionRepository implements ITransactionRepository {
  constructor(private prisma: PrismaClient) {}
  
  async create(data: CreateTransactionDto): Promise<TransactionData> {
    return await this.prisma.transaction.create({ data });
  }
  
  async findById(id: string): Promise<TransactionData | null> {
    return await this.prisma.transaction.findUnique({ where: { id } });
  }
  
  // ... implement all methods
}

// src/services/business/TransactionService.ts
export class TransactionService {
  constructor(
    private repository: ITransactionRepository, // Inject interface
    // ... other deps
  ) {}
  
  async addTransaction(userId: string, data: Transaction): Promise<TransactionResult> {
    // ... validation
    const transaction = await this.repository.create({
      userId,
      date: normalizedDate,
      amount: data.amount,
      // ...
    });
    // ...
  }
}
```

**Scope:** 4 files (2 repos + 2 services to refactor)  
**Tests:** Mock repositories in service tests  
**Acceptance:** 
- Services never import `PrismaClient` directly
- All DB access goes through repositories
**Rollback:** Services use Prisma directly again  
**PR:** 2 PRs (TransactionRepo + RecurringTransactionRepo)

---

#### **F9: Type-Safe AI Function Declarations**

**Evidence:**
```typescript
// src/services/ai/functionDeclarations.ts
// 302 lines of hand-written Gemini function schemas
// No compile-time validation that schemas match actual function signatures
```

**Problem:**
- Schema drift from implementation (e.g., add field to TypeScript but forget schema)
- No IntelliSense for function parameters
- Runtime errors from schema mismatches

**Recommendation:** Generate schemas from TypeScript types using **ts-to-zod** or **zod**:

```bash
npm install zod zod-to-json-schema
```

```typescript
// src/services/ai/functionSchemas.ts
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

// Define Zod schemas (co-located with types)
export const TransactionSchema = z.object({
  userId: z.string().uuid(),
  date: z.string().datetime(),
  amount: z.number().positive(),
  category: z.string(),
  description: z.string().optional(),
  type: z.enum(['expense', 'income']),
});

export const AddTransactionParamsSchema = z.object({
  transactionData: TransactionSchema,
});

// Generate Gemini-compatible JSON schema
export const addTransactionDeclaration = {
  name: 'addTransaction',
  description: 'Add a new transaction (expense or income)',
  parameters: zodToJsonSchema(AddTransactionParamsSchema, { $refStrategy: 'none' }),
};

// Type inference (TypeScript types derived from Zod)
export type Transaction = z.infer<typeof TransactionSchema>;
export type AddTransactionParams = z.infer<typeof AddTransactionParamsSchema>;
```

```typescript
// src/services/ai/functionDeclarationService.ts
async executeFunction(
  functionName: string,
  userId: string,
  parameters: unknown // Validate at runtime
): Promise<ServiceResult<unknown>> {
  switch (functionName) {
    case 'addTransaction':
      const parsed = AddTransactionParamsSchema.parse(parameters); // Runtime validation
      return await this.transactionService.addTransaction(userId, parsed.transactionData);
    // ...
  }
}
```

**Benefits:**
- Single source of truth (Zod schema)
- Runtime validation + compile-time types
- Schema changes break at compile time

**Scope:** 1 file (302 lines refactored)  
**Tests:** Schema validation tests (test invalid inputs)  
**Acceptance:** 
- All function declarations generated from Zod
- Invalid params throw validation errors (tested)
**Rollback:** Revert to hand-written schemas  
**PR:** 1 PR (schema migration)

---

### 🔵 **LOW** (Polish & Optimization)

#### **F10: MongoDB-Specific Optimizations**

**Evidence:**
```prisma
// prisma/schema.prisma
datasource db {
  provider = "mongodb"
  url      = env("DATABASE_URL")
}

model Transaction {
  id   String @id @default(uuid()) @map("_id")
  date String // ISO-8601 DateTime string
  // ...
  @@index([userId])
}
```

**Problem:**
- Using UUID for MongoDB (should use ObjectId)
- Storing dates as strings (loses MongoDB date queries)
- No compound indexes for common queries
- No text indexes for description search

**Recommendation:** Optimize Prisma schema for MongoDB:

```prisma
model Transaction {
  id   String @id @default(auto()) @map("_id") @db.ObjectId
  date DateTime @db.Date
  // ...
  
  @@index([userId, date]) // Compound index for date range queries
  @@index([userId, type, category]) // Category filtering
  @@index([description]) // Text search
}
```

**Migration:**
```typescript
// scripts/migrateToObjectId.ts
// 1. Add new `_id_new` field as ObjectId
// 2. Copy data with ObjectId generation
// 3. Update foreign keys
// 4. Drop old UUID field
// 5. Rename `_id_new` to `_id`
```

**Scope:** 2 models, migration script  
**Tests:** Integration tests verify data integrity  
**Acceptance:** 
- All IDs are ObjectIds
- Date queries use native MongoDB operators
**Rollback:** Revert schema, run reverse migration  
**PR:** 1 PR (schema + migration)

---

#### **F11: Extract Configuration Validation**

**Evidence:**
```typescript
// src/config/config.ts
export const config = {
  port: process.env.PORT || 3001,
  geminiApiKey: process.env.GEMINI_API_KEY, // No validation!
  // ...
};

// src/services/dependencyService.ts:43
if (!config.geminiApiKey) {
  throw new Error('GEMINI_API_KEY environment variable is required');
}
```

**Problem:**
- Config validation scattered across app
- App starts, then crashes in DependencyService
- No type safety for env vars

**Recommendation:** Use **zod** + **dotenv-safe**:

```bash
npm install zod dotenv-safe
```

```typescript
// src/config/env.ts
import { z } from 'zod';
import dotenv from 'dotenv-safe';

dotenv.config({ example: '.env.example' });

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().regex(/^\d+$/).transform(Number).default('3001'),
  GEMINI_API_KEY: z.string().min(1),
  GEMINI_MODEL: z.string().default('gemini-2.0-flash'),
  DATABASE_URL: z.string().url(),
  QDRANT_URL: z.string().url().default('http://localhost:6333'),
  EMBEDDING_THRESHOLD: z.string().regex(/^\d+(\.\d+)?$/).transform(Number).default('0.8'),
  WHATSAPP_API_URL: z.string().url().default('http://localhost:3000'),
  DELETION_CONFIRMATION_WINDOW: z.string().regex(/^\d+$/).transform(Number).default('120'),
});

export const env = envSchema.parse(process.env);
export type Env = z.infer<typeof envSchema>;
```

```typescript
// src/config/config.ts
import { env } from './env';

export const config = {
  port: env.PORT,
  geminiApiKey: env.GEMINI_API_KEY,
  // ... use env everywhere
};
```

**Scope:** 2 files  
**Tests:** Test invalid env vars throw at startup  
**Acceptance:** 
- Missing env var crashes immediately with clear error
- `.env.example` created with all required vars
**Rollback:** Revert to manual validation  
**PR:** 1 PR (env validation)

---

#### **F12: Reduce Qdrant Service Boilerplate**

**Evidence:**
```typescript
// src/services/ai/embedding/QdrantService.ts
// 195 lines, lots of manual error handling and `as any` casts
```

**Problem:**
- Qdrant client wrapper adds little value
- Could use official SDK methods directly
- Error handling duplicated across methods

**Recommendation:** 
1. Consider removing `QdrantService` wrapper entirely (use `QdrantClient` directly)
2. If keeping wrapper, add proper TypeScript types for Qdrant responses

```typescript
// Option 1: Use client directly in services
import { QdrantClient } from '@qdrant/js-client-rest';

export class TransactionEmbeddingService {
  constructor(
    private embedder: Embedder,
    private qdrant: QdrantClient, // Direct injection
    // ...
  ) {}
}

// Option 2: Type the wrapper properly
import { Schemas } from '@qdrant/js-client-rest';

async queryVector(
  collectionName: string,
  vector: number[],
  limit = 5,
  filter?: Schemas['Filter']
): Promise<Schemas['ScoredPoint'][]> {
  const response = await this.client.search(collectionName, {
    vector,
    limit,
    filter,
  });
  
  return response; // Properly typed
}
```

**Scope:** 1 file (195 lines → ~50 lines or deleted)  
**Tests:** Existing embedding tests still pass  
**Acceptance:** No `as any` casts in Qdrant logic  
**Rollback:** Restore QdrantService wrapper  
**PR:** 1 PR (simplify or remove)

---

## 3. Code Duplication Map

| Location | Clone | Lines | Impact |
|----------|-------|-------|--------|
| **RecurringTransactionService** ↔ **TransactionService** | Import + constructor setup | 23 | 🔴 HIGH - Changes to DI affect both |
| **RecurringTransactionService** ↔ **TransactionLookupService** | Embedding sync logic | 13 | 🟠 MEDIUM - Bug fixes need 2 places |
| **TransactionLookupService** (internal) | Query building | 15 | 🟡 LOW - Same file, easy to extract |
| **TransactionEmbeddingService** (internal) | Metadata building | 11 | 🟡 LOW - Same file |
| **FreeformTransactionSearchService** (internal) | Result mapping | 19 | 🟡 LOW - Same file |
| **Generated Prisma files** | Edge/browser shims | 119 | ⚪ IGNORE - Auto-generated |

**Recommendation:** Prioritize cross-file clones first (F6), then refactor internal duplication during service decomposition (F4).

---

## 4. Complexity Hotspots

### File Size Analysis

| File | Lines | Cyclomatic Complexity | Recommendation |
|------|-------|----------------------|----------------|
| `RecurringTransactionService` | 583 | High (nested validation) | **F4** - Split into 4 services |
| `CategoryClassificationService` | 501 | Medium (init logic heavy) | **F4** - Extract seeder |
| `TransactionService` | 458 | High (CRUD + deletion state) | **F4** - Split into 3 services |
| `functionDeclarations.ts` | 302 | Low (data structure) | **F9** - Generate from types |
| `systemInstruction.ts` | 227 | Low (config text) | Keep as-is |
| `MessageBuilder` | 220 | Medium (many helpers) | Consider splitting by concern |
| `TransactionEmbeddingService` | 215 | Medium | Acceptable size |

### Function Complexity (Candidates for Decomposition)

```typescript
// RecurringTransactionService.ts:239
async editRecurringTransactionById(userId, id, updates): Promise<RecurringTransactionResult> {
  // 97 lines - handles lookup + validation + category classification + update + embedding sync
  // → Extract: validateUpdates(), applyUpdates(), syncAfterUpdate()
}

// TransactionService.ts:138
private buildTransactionUpdateData(userId, updates, existingTransaction): {...} {
  // 60 lines - complex validation merge logic
  // → Extract to separate validator class
}

// CategoryClassificationService.ts:447
private async seedCollection(collection, exemplars): Promise<void> {
  // 52 lines - embedding batch + upsert
  // → Move entire method to CategoryExemplarSeeder (F4)
}

// RecurrencePattern.ts:74
calculateNextDueDate(): string {
  // 133 lines - complex date math (monthly/yearly edge cases)
  // → Extract: calculateMonthly(), calculateYearly() sub-methods
}
```

**Stepwise Decomposition (Example: `editRecurringTransactionById`)**

1. **Extract validation** → `private async validateRecurringUpdates()`
2. **Extract category logic** → Reuse `CategoryClassificationService.classifyCategory()`
3. **Extract update logic** → `private async applyRecurringTransactionUpdate()`
4. **Extract embedding sync** → Use shared helper from F6

---

## 5. Dependencies & Dead Code

### Dependency Health

| Package | Version | Issue | Recommendation |
|---------|---------|-------|----------------|
| `jws` | 4.0.0 | 🔴 High severity HMAC vulnerability | **F1** - `npm audit fix` immediately |
| `@prisma/client` | 6.19.0 | ⚠️ Custom output path | Document in README (intentional) |
| `express` | 5.1.0 | ⚠️ Major version (beta) | Monitor for stability; consider 4.x LTS |
| `chrono-node` | 2.9.0 | ✅ Used once in `naturalDateParser.ts` | Keep |
| All others | - | ✅ Healthy | - |

### Unused Dependencies (from `depcheck`)

- `@prisma/client` - False positive (used via generated code)
- `prisma` - False positive (CLI tool)

### Dead Code Candidates

```bash
# Search for unused exports
npx ts-prune
```

**Potential Dead Code:**
1. `src/lib/WhatsAppPostProcessor.ts` - File exists but no imports found
2. `src/services/infrastructure/database/schemas.ts` - MongoDB schemas not imported elsewhere
3. `naturalDateParser.ts:38` - Debug console.log should be removed

**Verification needed:**
```bash
npx ts-unused-exports tsconfig.json
```

---

## 6. Test Strategy

### Testing Pyramid (Target Coverage)

```
        🔺 E2E Tests (5%)
           - Full WhatsApp webhook flow
           - AI function calling integration

    🔶 Integration Tests (15%)
       - Service + Prisma + MongoDB
       - Embedding + Qdrant

  🔷 Unit Tests (80%)
     - Pure functions (validators, normalizers)
     - Service methods (mocked dependencies)
     - Domain objects (RecurrencePattern)
```

### Priority Test Targets (Ordered by Risk)

1. **Critical Path (Must Have)**
   - ✅ `TransactionValidator` - amount/date/type validation
   - ✅ `CategoryNormalizer` - fuzzy matching logic
   - ✅ `RecurrencePattern.calculateNextDueDate()` - complex date math
   - ✅ `DateNormalizer` - ISO string conversion

2. **High Risk (Should Have)**
   - ⚠️ `TransactionService.addTransaction()` - E2E with mocks
   - ⚠️ `RecurringTransactionService.createRecurringTransaction()` - Pattern validation
   - ⚠️ `FunctionDeclarationService.executeFunction()` - Parameter mapping
   - ⚠️ `AIMessageService.handleMessage()` - Iteration loop

3. **Medium Risk (Nice to Have)**
   - 🔵 `CategoryClassificationService` - Embedding search
   - 🔵 `MessageBuilder` - String formatting
   - 🔵 `DeletionStateService` - Expiration logic

4. **Integration (Smoke Tests)**
   - 🟢 POST /whatsapp with "I spent $50 on coffee" → Transaction created
   - 🟢 POST /whatsapp with "Delete last transaction" → Confirmation flow

### Test Implementation Steps

**Phase 1: Pure Functions (Week 1)**
```bash
npm install --save-dev jest ts-jest @types/jest
npx ts-jest config:init
```

- `validators/__tests__/*.test.ts`
- `lib/__tests__/*.test.ts` (normalizers, message builder)
- `domain/__tests__/*.test.ts` (RecurrencePattern)

**Phase 2: Service Mocks (Week 2)**
```typescript
// Mock Prisma
jest.mock('../../lib/PrismaClientManager', () => ({
  PrismaClientManager: { getClient: () => mockPrisma }
}));

// Mock external APIs
jest.mock('../ai/embedding/Embedder');
jest.mock('../ai/embedding/QdrantService');
```

**Phase 3: Integration (Week 3)**
```typescript
// Test database setup
beforeAll(async () => {
  await prisma.$connect();
  await prisma.transaction.deleteMany(); // Clean slate
});

test('creates transaction with embedding', async () => {
  const result = await transactionService.addTransaction(userId, data);
  expect(result.success).toBe(true);
  
  const embedded = await qdrant.scroll('transactions', { userId });
  expect(embedded.points.length).toBe(1);
});
```

**Coverage Goals:**
- 🎯 Week 1: 50% line coverage (pure functions)
- 🎯 Week 2: 70% line coverage (services)
- 🎯 Week 3: 75% line coverage (integration)

---

## 7. PR Sequencing Plan (5-15 PRs)

### Phase 1: Foundation & Safety (PRs 1-3) 🔴 CRITICAL

| PR | Title | Scope | Risk | Dependencies |
|----|-------|-------|------|--------------|
| **PR-1** | Fix: Security vulnerability in `jws` dependency | `package-lock.json` | 🟢 LOW | None |
| **PR-2** | Feat: Add Jest testing infrastructure | `jest.config.js`, test setup | 🟢 LOW | None |
| **PR-3** | Test: Pure functions (validators, normalizers, domain) | `__tests__/` dirs | 🟢 LOW | PR-2 |

**Rationale:** Secure the app and establish test safety net before refactoring.

---

### Phase 2: Type Safety (PRs 4-6) 🟠 HIGH

| PR | Title | Scope | Risk | Dependencies |
|----|-------|-------|------|--------------|
| **PR-4** | Refactor: Type-safe DependencyService registry | `dependencyService.ts` | 🟡 MEDIUM | PR-3 (tests) |
| **PR-5** | Refactor: Eliminate `any` in AI function parameters | `functionDeclarationService.ts`, `types/ai.ts` | 🟡 MEDIUM | PR-4 |
| **PR-6** | Refactor: Type Qdrant service methods | `QdrantService.ts` | 🟢 LOW | PR-5 |

**Rationale:** Types enable safe refactoring in later phases.

---

### Phase 3: Architecture Improvements (PRs 7-10) 🟡 MEDIUM

| PR | Title | Scope | Risk | Dependencies |
|----|-------|-------|------|--------------|
| **PR-7** | Refactor: Extract base service class + deduplicate constructors | `BaseTransactionService.ts`, services | 🟡 MEDIUM | PR-3 |
| **PR-8** | Refactor: Split TransactionService → 3 focused services | `transaction/` folder | 🔴 HIGH | PR-7 |
| **PR-9** | Refactor: Split RecurringTransactionService → 4 focused services | `recurring/` folder | 🔴 HIGH | PR-7 |
| **PR-10** | Refactor: Extract CategoryExemplarSeeder from classification service | `CategoryExemplarSeeder.ts` | 🟢 LOW | PR-7 |

**Rationale:** Service decomposition requires stable base (tests + types).

---

### Phase 4: Repository Pattern (PRs 11-12) 🟢 LOW-MEDIUM

| PR | Title | Scope | Risk | Dependencies |
|----|-------|-------|------|--------------|
| **PR-11** | Feat: Implement TransactionRepository interface | `repositories/ITransactionRepository.ts`, `PrismaTransactionRepository.ts` | 🟡 MEDIUM | PR-8 |
| **PR-12** | Feat: Implement RecurringTransactionRepository interface | `repositories/IRecurringTransactionRepository.ts` | 🟡 MEDIUM | PR-9 |

**Rationale:** Services must be split before repositories can be injected cleanly.

---

### Phase 5: Observability & Polish (PRs 13-15) 🔵 OPTIONAL

| PR | Title | Scope | Risk | Dependencies |
|----|-------|-------|------|--------------|
| **PR-13** | Feat: Replace console.log with winston structured logging | All services, `logger.ts` | 🟡 MEDIUM | None (parallel) |
| **PR-14** | Refactor: Generate AI function schemas from Zod types | `functionSchemas.ts`, `functionDeclarations.ts` | 🟡 MEDIUM | PR-5 |
| **PR-15** | Feat: Environment validation with zod | `env.ts`, `.env.example` | 🟢 LOW | None (parallel) |

**Rationale:** Improves DX without touching core logic.

---

### PR Dependency Graph

```
PR-1 (Security) ────────────────────────────┐
                                            │
PR-2 (Jest) ──→ PR-3 (Pure Tests) ──┐      │
                                     ↓      │
PR-4 (DI Types) ──→ PR-5 (AI Types) → PR-6 (Qdrant) ──┐
        │                                               │
        └──→ PR-7 (Base Service + Dedupe) ─────────┐   │
                       │                           ↓   ↓
                       ├──→ PR-8 (Split Transaction) ──→ PR-11 (Repo)
                       │                           ↓   
                       ├──→ PR-9 (Split Recurring) ───→ PR-12 (Repo)
                       │                           ↓
                       └──→ PR-10 (Split Category)

PR-13 (Logging) ──┐
PR-14 (Zod Schemas) ─┼──→ (Parallel, no dependencies)
PR-15 (Env Validation) ─┘
```

---

### Rollback Strategy

Each PR must be **independently revertible**:

1. **Test on feature branch** with CI passing
2. **Merge to staging** for smoke tests
3. **Production deploy** with rollback plan:
   - PR-1: `npm install` reverts lockfile
   - PR-4-6: Revert commits (types don't change runtime)
   - PR-7-10: Revert + `npm run build` (service changes)
   - PR-11-12: Revert + DB migration rollback (if schema changed)
   - PR-13-15: Revert commits (observability only)

---

## 8. Acceptance Criteria per Finding

| Finding | Acceptance Tests |
|---------|-----------------|
| **F1: Security** | `npm audit` shows 0 vulnerabilities |
| **F2: Types** | `grep -r "any" src/ --exclude-dir=generated` < 5 results; all justified |
| **F3: Tests** | `npm test` passes; coverage > 70% |
| **F4: Services** | All services < 250 lines; `npm run build` succeeds |
| **F5: Logging** | `LOG_LEVEL=error` suppresses debug logs; JSON output in prod |
| **F6: Duplication** | `npx jscpd src/ --min-lines 10` < 3 clones |
| **F7: DI** | `grep -r "getInstance" src/` returns 0 |
| **F8: Repositories** | Services don't import `PrismaClient` directly |
| **F9: Schemas** | Function schemas derived from Zod; invalid params throw |
| **F10: MongoDB** | All IDs are ObjectIds; date queries use native operators |
| **F11: Config** | Missing env var crashes at startup with clear error |
| **F12: Qdrant** | No `as any` casts in Qdrant logic |

---

## 9. Appendix

### Useful Commands

```bash
# Run full audit suite
npm run build && npm test && npm audit && npx madge --circular src/ && npx jscpd src/

# Check type coverage
npx type-coverage --at-least 90

# Find unused exports
npx ts-prune

# Analyze bundle size
npx webpack-bundle-analyzer dist/stats.json

# Generate dependency graph
npx madge --image graph.png src/index.ts
```

### Recommended Tools

- **Testing:** Jest, ts-jest, @testing-library/node (if needed)
- **Logging:** winston, pino (alternative)
- **Validation:** zod, class-validator (alternative)
- **DI:** tsyringe, inversify, or manual factory
- **Code Quality:** eslint, prettier, husky (pre-commit hooks)
- **CI:** GitHub Actions (test + audit on PR)

### Long-Term Improvements (Beyond this report)

1. **API Versioning** - Add `/v1/whatsapp` endpoints for breaking changes
2. **Rate Limiting** - Protect webhook from spam (express-rate-limit)
3. **Idempotency Keys** - Prevent duplicate transactions from retries
4. **Caching** - Redis for conversation history + category exemplars
5. **Batch Processing** - Queue system for recurring transaction generation
6. **Observability** - OpenTelemetry, Sentry error tracking
7. **Documentation** - OpenAPI spec for webhook endpoints

---

## Summary Checklist

**Before starting refactor:**
- [ ] PR-1: Fix security vulnerability
- [ ] PR-2-3: Establish test infrastructure + pure function tests
- [ ] Confirm all builds pass
- [ ] Create feature branch per PR

**During refactor:**
- [ ] One PR at a time, following dependency graph
- [ ] Run tests after each merge
- [ ] Update documentation (README, inline comments)
- [ ] Monitor production after each deploy

**After refactor:**
- [ ] All 12 findings addressed or scheduled
- [ ] Code coverage > 70%
- [ ] No high severity vulnerabilities
- [ ] CI/CD pipeline includes: build + test + audit

---

**End of Report**
