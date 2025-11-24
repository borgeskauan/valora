# Expense Tracker Bot - Codebase Structure

## Project Overview
WhatsApp-based financial tracking bot using Google Gemini AI (gemini-2.0-flash) for natural language processing. Users send transaction messages via WhatsApp; Gemini extracts structured data and calls functions to store transactions (expenses or income) in MongoDB.

## Architecture Pattern: AI Function Calling Pipeline

**Critical Flow**: WhatsApp → WhatsAppController → AIMessageService (iterative loop) → GeminiService → Function Execution → Response

### AI Function Declarations (10 total)
Located in `src/services/ai/functionDeclarationService.ts`:

1. **getCurrentDate()** - Returns current date for relative date calculations
2. **addTransaction(transactionData)** - Unified function for expenses and income (type field)
3. **createRecurringTransaction(recurringTransactionData)** - Unified for recurring expenses/income (type field)
4. **editLastTransaction(updates)** - Edits most recent transaction
5. **editLastRecurringTransaction(updates)** - Edits most recent recurring transaction
6. **editTransactionById(id, updates)** - Edits specific transaction by ID
7. **editRecurringTransactionById(id, updates)** - Edits specific recurring transaction by ID
8. **queryTransactions(queryDescription, sqlQuery)** - Queries for reports or finding transactions to edit/delete
9. **deleteTransactions(ids)** - Permanently deletes one or multiple one-time transactions (hard delete)
10. **disableRecurringTransactions(ids)** - Deactivates one or multiple recurring transactions (soft delete)

### Delete Operations Pattern
- **Hard Delete** (Transaction table): Permanent removal via Prisma `deleteMany`
- **Soft Delete** (RecurringTransaction table): Sets `isActive = false` via Prisma `updateMany`
- **Batch Support**: Both functions accept array of IDs
- **All-or-Nothing Validation**: If any ID fails validation, entire operation fails
- **Workflow**: queryTransactions → present matches → user confirms → call delete function with IDs

## Key Services

### TransactionService (`src/services/business/transactionService.ts`)
Full CRUD operations for one-time transactions:
- `addTransaction(data)` - Creates transaction (expense or income based on type)
- `editLastTransaction(userId, updates)` - Edits most recent transaction
- `editTransactionById(userId, id, updates)` - Edits specific transaction by ID
- `deleteTransactions(userId, ids)` - Permanently deletes transactions by IDs (batch support)
- Returns `ServiceResult<T>` for all operations

### RecurringTransactionService (`src/services/business/recurringTransactionService.ts`)
Full CRUD operations for recurring transactions:
- `createRecurringTransaction(data)` - Creates recurring transaction (expense or income)
- `editLastRecurringTransaction(userId, updates)` - Edits most recent recurring
- `editRecurringTransactionById(userId, id, updates)` - Edits specific recurring by ID
- `disableRecurringTransactions(userId, ids)` - Deactivates recurring transactions by IDs (batch support)
- Uses RecurrencePattern domain object for frequency calculations
- Returns `ServiceResult<T>` for all operations

### TransactionQueryService (`src/services/business/transactionQueryService.ts`)
Query operations with dual purpose:
- `queryTransactions(userId, description, sqlQuery)` - Executes SQL queries
- Used for reports AND discovering transaction IDs for editing/deleting
- Queries "Transaction" table for one-time transactions
- Queries "RecurringTransaction" table for recurring transactions
- Query must include 'id' column when finding transactions to edit/delete
- Returns formatted results for AI to present to users

### QueryExecutorService (`src/services/business/queryExecutorService.ts`)
Low-level SQL execution:
- Validates SQL queries (SELECT only, no destructive operations)
- Prevents SQL injection (parameterized queries, whitelist validation)
- Returns raw query results

## Composition Pattern (Not Inheritance)

Services compose shared utility classes instead of inheritance:

### CategoryNormalizer (`src/lib/CategoryNormalizer.ts`)
- Validates categories against `EXPENSE_CATEGORIES` or `INCOME_CATEGORIES` based on transaction type
- Fuzzy matching for user-friendly input
- Returns normalized category and warnings

### MessageBuilder (`src/lib/MessageBuilder.ts`)
- Formats success messages with transaction type-specific wording
- Includes category warnings when normalization occurs
- Example: "Expense added: $50 for Food & Dining" vs "Income added: $500 for Salary"

### PrismaClientManager (`src/lib/PrismaClientManager.ts`)
- Singleton Prisma client (avoids multiple connections)
- Custom output path: `src/generated/prisma`
- Import: `import { PrismaClient } from '../generated/prisma'`

### UserContextProvider (`src/lib/UserContextProvider.ts`)
- Injects `userId` into operations for ownership validation
- Ensures users can only access their own transactions

## Domain Objects

### RecurrencePattern (`src/domain/RecurrencePattern.ts`)
Encapsulates recurring transaction logic:
- Frequency calculations (daily, weekly, monthly, yearly)
- Weekly: requires `dayOfWeek` (0-6, Sunday-Saturday)
- Monthly: requires `dayOfMonth` (1-31)
- Yearly: requires `monthOfYear` (0-11, January-December)
- `nextDue()` calculates next occurrence date
- Validation logic for frequency-specific requirements

## ServiceResult Pattern

All service methods return `ServiceResult<T>` from `src/types/ServiceResult.ts`:

```typescript
// Success case
return success(data, "Expense added: $50 for Food & Dining", ["Category normalized from 'food' to 'Food & Dining'"]);

// Failure case
return failure("Validation failed", "VALIDATION_ERROR", "Amount must be positive", ["Amount must be positive"]);
```

- `success<T>(data, message, warnings?)` for success
- `failure(message, code?, details?, validationErrors?)` for errors
- Validators NEVER throw - they return `ValidationResult` objects
- Services return `failure()` for validation errors instead of throwing
- AI receives structured error information for user-friendly messages

## Database (Prisma + MongoDB)

### Custom Output Path
```prisma
generator client {
  output = "../src/generated/prisma"
}
```
Import: `import { PrismaClient } from '../generated/prisma'`

### Database: MongoDB
- Connection: `mongodb://localhost:27017/expense-tracker` (local)
- Cloud: MongoDB Atlas `mongodb+srv://username:password@cluster.mongodb.net/expense-tracker`
- Configured in `prisma/schema.prisma`: `datasource db { provider = "mongodb" }`

### Models
- **Transaction**: One-time transactions (hard delete)
- **RecurringTransaction**: Subscriptions, bills, recurring income (soft delete via isActive)
- Both have `type` field ('expense' | 'income')
- Both have `category` field (validated against type-specific categories)

### Schema Synchronization
- MongoDB with Prisma uses `db push` instead of migrations: `npx prisma db push`
- Schema changes: Update `prisma/schema.prisma` → run `npx prisma db push` → regenerate client
- Note: MongoDB with Prisma doesn't use traditional migrations; it syncs schema directly

## Configuration Files

### Transaction Types (`src/config/transactionTypes.ts`)
- `TRANSACTION_TYPES = ['expense', 'income']`
- Stored as string in database, validated via enum

### Expense Categories (`src/config/expenseCategories.ts`)
- Food & Dining, Transportation, Shopping, Entertainment, Bills & Utilities, Healthcare, Personal Care, Travel, Education, Groceries, Housing, Insurance, Savings & Investments, Gifts & Donations, Other

### Income Categories (`src/config/incomeCategories.ts`)
- Salary, Freelance, Investment Returns, Business Income, Rental Income, Gifts Received, Refunds, Bonuses, Side Hustle, Other

### Frequencies (`src/config/frequencies.ts`)
- daily, weekly, monthly, yearly
- Weekly requires dayOfWeek (0-6)
- Monthly requires dayOfMonth (1-31)
- Yearly requires monthOfYear (0-11)

## Error Handling

### Custom Error Hierarchy (`src/errors/ApplicationError.ts`)
- `ApplicationError` (base): Includes `code`, `statusCode`, `details`, `timestamp`
- `ValidationError` (400): Input validation failures
- `DatabaseError` (500): Prisma errors
- Validators throw `ValidationError`, repositories throw `DatabaseError`

## Validators

### TransactionValidator (`src/validators/TransactionValidator.ts`)
- Validates transaction data (amount, category, date, type)
- Normalizes Date objects to ISO strings
- Returns `ValidationResult` (never throws)

### RecurringTransactionValidator (`src/validators/RecurringTransactionValidator.ts`)
- Validates recurring transaction data
- Validates frequency-specific requirements (dayOfWeek, dayOfMonth, monthOfYear)
- Uses RecurrencePattern for validation logic
- Returns `ValidationResult` (never throws)

## Conversation Persistence

### ConversationService (`src/services/infrastructure/conversationService.ts`)
- Stores all messages in Prisma as JSON (user, model, function calls)
- Retrieved history passed to AIMessageService for context-aware responses
- Clear endpoint: `POST /whatsapp/conversation/clear/:userId`
- Singleton pattern

## Development Workflow

### Running Locally
```bash
npm run dev  # Starts nodemon with ts-node (hot reload)
```

### Building & Production
```bash
npm run build  # TypeScript → dist/ (CommonJS)
npm start      # Runs dist/index.js
```

### Testing WhatsApp Webhook
POST to `/whatsapp` with payload:
```json
{
  "remoteJid": "1234567890@s.whatsapp.net",
  "text": "I spent $25 on coffee yesterday",
  "pushName": "User Name",
  "fromMe": false
}
```

## Important Patterns

- **Composition Over Inheritance**: Services use shared utilities, not base classes
- **Singleton Pattern**: DependencyService, PrismaClientManager, conversationService, whatsappService
- **Type-Aware Functions**: Single addTransaction/createRecurringTransaction with type field (not separate functions)
- **Category Normalization**: AI sends any string, server fuzzy matches to valid category based on type
- **Date Handling**: Validators normalize Date to ISO strings; Gemini receives format instructions
- **Conversation History**: AIMessageService returns only NEW entries to avoid duplicates in DB
- **Batch Operations**: Delete functions support multiple IDs in single call (all-or-nothing validation)
