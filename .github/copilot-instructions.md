# Expense Tracker Bot - AI Agent Instructions

## Project Overview
WhatsApp-based financial tracking bot using Google Gemini AI for natural language processing. Users send transaction messages via WhatsApp; Gemini extracts structured data and calls functions to store transactions (expenses or income) in MongoDB.

## Architecture Pattern: AI Function Calling Pipeline

**Critical Flow**: WhatsApp → WhatsAppController → AIMessageService (iterative loop) → GeminiService → Function Execution → Response

1. **AIMessageService** (`src/services/aiMessageService.ts`) orchestrates iterative function calling:
   - Maintains conversation history as `Content[]` array
   - Loops up to a maximum number of iterations calling Gemini until no more function calls returned
   - Each iteration: sends contents → receives response → executes functions → appends function results → repeats
   - Returns `FunctionCallResult` with response, function history, and new conversation entries

2. **Conversation Persistence** (`src/services/conversationService.ts`): 
   - Stores all messages in Prisma (user, model, function calls) as JSON
   - Retrieved history passed to AIMessageService for context-aware responses
   - Clear endpoint: `POST /whatsapp/conversation/clear/:userId`

3. **Dependency Injection Singleton** (`src/services/dependencyService.ts`):
   - All services initialized via `DependencyService.getInstance()`
   - Services wired: GeminiService → AIMessageService → WhatsAppController
   - Configuration loaded from `src/config/index.ts` (validates env vars)

## Key Patterns & Conventions

### Composition Over Inheritance
Services use **shared utility classes** (not base classes):
- `CategoryNormalizer`: Validates categories against `EXPENSE_CATEGORIES` or `INCOME_CATEGORIES` based on transaction type
- `PrismaClientManager`: Singleton Prisma client (avoid multiple connections)
- `UserContextProvider`: Injects `userId` into operations
- `MessageBuilder`: Formats success messages with transaction type-specific wording and category warnings

**Example**: `TransactionService` composes these utilities, not inheritance hierarchy.

### ServiceResult Pattern
All service methods return `ServiceResult<T>` from `src/types/ServiceResult.ts`:
```typescript
// Success case
return success(data, "Expense added: $50 for Food & Dining", ["Category normalized from 'food' to 'Food & Dining'"]);

// Failure case with validation errors
return failure("Validation failed", "VALIDATION_ERROR", "Amount must be positive", ["Amount must be positive"]);
```
- `success<T>(data, message, warnings?)` for success
- `failure(message, code?, details?, validationErrors?)` for errors
- **CRITICAL**: Validators NEVER throw - they return `ValidationResult` objects
- Services return `failure()` for validation errors instead of throwing
- AI receives structured error information and generates user-friendly messages
- Used by AI function declarations to return structured responses for both success and failure

### Domain Objects for Complex Logic
- `RecurrencePattern` (`src/services/domain/RecurrencePattern.ts`): Encapsulates frequency calculations (nextDue, validation)
- Validators separate from business logic: `TransactionValidator`, `RecurringTransactionValidator` in `src/validators/`

### Repository Pattern
- `TransactionRepository`, `RecurringTransactionRepository` in `src/services/repositories/` (if implemented)
- Services call repositories for DB access (never direct Prisma in services)
- Repositories use `PrismaClientManager.getClient()` for shared client

### Error Hierarchy
Custom error classes in `src/errors/ApplicationError.ts`:
- `ApplicationError` (base): Includes `code`, `statusCode`, `details`, `timestamp`
- `ValidationError` (400): Input validation failures
- `DatabaseError` (500): Prisma errors
- Validators throw `ValidationError`, repositories throw `DatabaseError`

## Prisma Configuration

**Custom Output Path**: Prisma client generated to `src/generated/prisma` (not default `node_modules`):
```prisma
generator client {
  output = "../src/generated/prisma"
}
```
Import as: `import { PrismaClient } from '../generated/prisma'`

**Database**: MongoDB (connection via DATABASE_URL environment variable)

**Migrations**: 
- MongoDB with Prisma uses `db push` for schema synchronization: `npx prisma db push`
- Schema changes: Update `prisma/schema.prisma` → run `npx prisma db push` → regenerate client
- Note: MongoDB with Prisma doesn't use traditional migrations; it syncs schema directly

## Function Declarations for Gemini

Defined in `src/services/functionDeclarationService.ts`:
- `getCurrentDate()`: Returns current date for relative date calculations
- `addTransaction(transactionData)`: Adds transaction (expense or income based on type field)
- `createRecurringTransaction(recurringTransactionData)`: Creates recurring transaction (expense or income based on type field)
- `editLastTransaction(updates)`: Edits most recent transaction
- `editLastRecurringTransaction(updates)`: Edits most recent recurring transaction
- `editTransactionById(id, updates)`: Edits a specific transaction by its ID
- `editRecurringTransactionById(id, updates)`: Edits a specific recurring transaction by its ID
- `queryTransactions(queryDescription, sqlQuery)`: Queries transaction data for reports, finding transactions to edit, or finding transactions to delete
- `deleteTransactions(ids)`: Permanently deletes one or multiple transactions by their IDs
- `disableRecurringTransactions(ids)`: Deactivates one or multiple recurring transactions by their IDs

**CRITICAL - Unified Functions Pattern**: 
- Single `addTransaction` function handles both expenses and income via `type` field
- Single `createRecurringTransaction` function handles both recurring expenses and income via `type` field
- AI chooses appropriate `type` value ('expense' or 'income') based on user intent
- Category validation happens server-side based on the type field

**Query Function Dual Purpose**:
- `queryTransactions` serves multiple purposes: generating reports AND discovering transaction IDs for editing/deleting
- When finding transactions for editing/deleting, query must include `id` column in SELECT
- Query the "Transaction" table for one-time transactions
- Query the "RecurringTransaction" table for recurring transactions (subscriptions, bills, recurring income)
- Results include transaction IDs that can be used with `editTransactionById`, `editRecurringTransactionById`, `deleteTransactions`, or `disableRecurringTransactions`

**Delete Operations**:
- `deleteTransactions` permanently removes one-time transactions (hard delete)
- `disableRecurringTransactions` deactivates recurring transactions (soft delete via isActive flag)
- Both functions support batch operations (multiple IDs in array)
- All-or-nothing approach: if any ID fails validation, entire operation fails
- Use queryTransactions to discover transaction IDs before deleting

**Transaction Types**: Enum in `src/config/transactionTypes.ts`:
- `TRANSACTION_TYPES = ['expense', 'income']`
- Stored as string in database, validated via enum

**Expense Categories**: `src/config/categories.ts` - `EXPENSE_CATEGORIES` array:
- Food & Dining, Transportation, Shopping, Entertainment, Bills & Utilities, Healthcare, Personal Care, Travel, Education, Groceries, Housing, Insurance, Savings & Investments, Gifts & Donations, Other

**Income Categories**: `src/config/incomeCategories.ts` - `INCOME_CATEGORIES` array:
- Salary, Freelance, Investment Returns, Business Income, Rental Income, Gifts Received, Refunds, Bonuses, Side Hustle, Other

**Frequencies**: `daily`, `weekly`, `monthly`, `yearly` from `src/config/frequencies.ts`
- Weekly requires `dayOfWeek` (0-6, Sunday-Saturday)
- Monthly requires `dayOfMonth` (1-31)
- Yearly requires `monthOfYear` (0-11, January-December)

## Development Workflow

### Running Locally
```bash
npm run dev  # Starts nodemon with ts-node (hot reload)
```
Requires `.env`:
```
DATABASE_URL="mongodb://localhost:27017/expense-tracker"
GEMINI_API_KEY="your-key"
GEMINI_MODEL="gemini-2.0-flash"
SYSTEM_INSTRUCTION="You are a financial tracking assistant. Help users track expenses and income..."
WHATSAPP_API_URL="http://localhost:3000"
```

**MongoDB Setup**: Ensure MongoDB is running locally or use a cloud instance (MongoDB Atlas). The DATABASE_URL format:
- Local: `mongodb://localhost:27017/expense-tracker`
- Atlas: `mongodb+srv://username:password@cluster.mongodb.net/expense-tracker`

### Building & Production
```bash
npm run build  # TypeScript → dist/ (CommonJS)
npm start      # Runs dist/index.js
```
**Note**: Use CommonJS (`"type": "commonjs"` in package.json) due to Prisma client compatibility.

### Testing WhatsApp Webhook
Webhook expects POST to `/whatsapp` with payload:
```json
{
  "remoteJid": "1234567890@s.whatsapp.net",
  "text": "I spent $25 on coffee yesterday",
  "pushName": "User Name",
  "fromMe": false
}
```
Response includes function call trace: `functionUsed`, `functionCalls`, `iterations`.

## Adding New Features

### New Function Declaration
1. Add declaration object in `FunctionDeclarationService` (follow existing pattern with `Type.OBJECT`)
2. Choose appropriate category enum (EXPENSE_CATEGORIES or INCOME_CATEGORIES)
3. Implement executor in `executeFunction()` switch statement - set type field before calling service
4. Create service method (returns `ServiceResult<T>`)
5. If new entity: Add Prisma model → migrate → create repository/service

### New Service
1. Create in `src/services/` using composition pattern (inject shared utilities)
2. Register in `DependencyService.initialize()` if needed globally
3. Use `ServiceResult<T>` return type for consistency
4. Follow repository pattern for DB access

## Important Quirks

- **Conversation History**: AIMessageService receives full history but only returns NEW entries (`newConversationEntries`) to avoid duplicates in DB
- **Category Normalization**: AI can send any string, CategoryNormalizer fuzzy matches to valid category based on transaction type, returns warnings
- **Type-Aware Categories**: CategoryNormalizer accepts `type` parameter to validate against correct category set
- **Separate AI Functions**: 2 distinct functions (addTransaction, createRecurringTransaction) - each sets type internally
- **Prisma Import Path**: Always `from '../generated/prisma'` (relative to current file depth)
- **Singleton Pattern**: DependencyService, PrismaClientManager, conversationService, whatsappService are all singletons (avoid duplicate instances)
- **Date Handling**: TransactionValidator normalizes Date objects to ISO strings; Gemini receives format instructions in function declarations
