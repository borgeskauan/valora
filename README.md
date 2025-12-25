# Expense Tracker Bot

## Overview
WhatsApp-based financial tracking bot that uses Google Gemini AI for natural language processing. Users send transaction messages via WhatsApp (e.g., "I spent $25 on coffee yesterday"), and the bot extracts structured data to store expenses and income in MongoDB. The system maintains conversation history for context-aware responses and supports complex queries through AI function calling.

## Tech Stack
- **Runtime**: Node.js 20 (TypeScript)
- **Framework**: Express.js 5
- **Database**: MongoDB 8.2 (with replica set support)
- **Vector Database**: Qdrant (for semantic search)
- **ORM**: Prisma 6.19
- **AI**: Google Gemini API (@google/genai)
  - Model: gemini-2.0-flash (configurable)
  - Embeddings: gemini-embedding-001
- **Natural Language Processing**: chrono-node (date parsing)

## Features

### Natural Language Transaction Entry
Users send conversational messages to add expenses or income. The AI extracts amount, category, date, and description automatically.
- Example: "I spent $50 on groceries yesterday"
- Supports both expenses and income transactions
- Automatic date parsing (relative dates like "yesterday", "last Friday")

![Natural Language Entry UI](docs/screenshots/transaction-entry-ui.png)
![Natural Language Entry API](docs/screenshots/transaction-entry-api.png)

### Recurring Transaction Management
Create and manage recurring expenses/income (subscriptions, bills, salaries).
- Supported frequencies: daily, weekly, monthly, yearly
- Configurable intervals (e.g., "every 2 weeks")
- Automatic scheduling with next due date calculation
- Enable/disable recurring transactions

![Recurring Transactions UI](docs/screenshots/recurring-transactions-ui.png)
![Recurring Transactions API](docs/screenshots/recurring-transactions-api.png)

### AI-Powered Category Classification
Automatic category assignment based on transaction descriptions using Google Gemini AI.
- 15 expense categories (Food & Dining, Transportation, Shopping, etc.)
- 10 income categories (Salary, Freelance, Investment Returns, etc.)
- Fuzzy matching and normalization for user-provided categories
- Fallback to "Other" when classification is uncertain

![Category Classification API](docs/screenshots/category-classification-api.png)

### Semantic Transaction Search
Vector-based search using Qdrant for finding transactions by natural language queries.
- Powered by Gemini embeddings (gemini-embedding-001)
- Searches transaction descriptions semantically
- Configurable similarity threshold (default: 0.8)
- Supports up to 200 results per query

![Semantic Search API](docs/screenshots/semantic-search-api.png)

### Conversation History & Context
Maintains persistent conversation history per user for context-aware responses.
- Stored in MongoDB via Prisma
- Supports multi-turn conversations
- Clear conversation endpoint available
- Function call history tracking

![Conversation History API](docs/screenshots/conversation-history-api.png)

### Transaction Editing & Deletion
Edit or delete transactions by ID or by querying (e.g., "edit my last coffee purchase").
- Edit last transaction or specific transaction by ID
- Batch deletion support (multiple transactions at once)
- Soft delete for recurring transactions (disable via isActive flag)
- Deletion confirmation window (default: 120 seconds)

![Transaction Editing API](docs/screenshots/transaction-editing-api.png)

### SQL Query Generation
AI generates and executes SQL-like MongoDB aggregation queries for custom reports.
- Natural language to MongoDB aggregation pipeline
- Supports filtering, grouping, sorting, limiting
- Automatic userId injection for security
- Optional semantic pre-filtering for text-based queries

![Query Generation API](docs/screenshots/query-generation-api.png)

### AI Function Calling Pipeline
Iterative function calling loop allows AI to execute multiple operations in sequence.
- Functions: `getCurrentDate`, `addTransaction`, `createRecurringTransaction`, `editTransaction`, `deleteTransactions`, `queryTransactions`, etc.
- Maximum iteration limit to prevent infinite loops
- Structured `ServiceResult` pattern for success/failure handling
- Validation errors returned to AI for user-friendly messaging

![Function Calling API](docs/screenshots/function-calling-api.png)

## Running the Project

This project uses Docker Compose for orchestration with three services:
- **MongoDB** (replica set enabled for transactions)
- **Qdrant** (vector database)
- **expense-tracker-bot** (Node.js application)

The application is containerized using a multi-stage Dockerfile that builds TypeScript code and runs in production mode.

## Configuration

Required environment variables (create `.env.docker` for Docker or `.env` for local development):

```bash
# Database
DATABASE_URL="mongodb://mongodb:27017/expense-tracker"  # Use localhost:27017 for local dev

# Gemini AI
GEMINI_API_KEY="your-google-gemini-api-key"
GEMINI_MODEL="gemini-2.0-flash"  # Optional, defaults to gemini-2.0-flash

# Qdrant Vector Database
QDRANT_URL="http://qdrant:6333"  # Use http://localhost:6333 for local dev
EMBEDDING_THRESHOLD="0.8"  # Optional, similarity threshold for semantic search

# WhatsApp Integration
WHATSAPP_API_URL="http://localhost:3000"  # External WhatsApp service endpoint

# Server
PORT="3001"  # Optional, defaults to 3001

# Deletion Confirmation
DELETION_CONFIRMATION_WINDOW="120"  # Optional, seconds before deletion is permanent
```

**Note**: `SYSTEM_INSTRUCTION` is defined in `src/config/systemInstruction.ts` and not configured via environment variables.

### Prisma Configuration
Prisma client is generated to a custom output path: `src/generated/prisma`. After schema changes, run:
```bash
npx prisma db push  # MongoDB schema sync
npx prisma generate  # Regenerate client
```

## Usage

### WhatsApp Webhook Integration
The bot exposes a webhook endpoint at `POST /whatsapp` that receives messages from an external WhatsApp service.

**Webhook Payload Format**:
```json
{
  "remoteJid": "1234567890@s.whatsapp.net",
  "text": "I spent $25 on coffee yesterday",
  "pushName": "User Name",
  "fromMe": false
}
```

**Webhook Response Format**:
```json
{
  "success": true,
  "message": "Expense added: $25.00 for Food & Dining on 2025-12-23",
  "functionUsed": "addTransaction",
  "functionCalls": ["getCurrentDate", "addTransaction"],
  "iterations": 2
}
```

### API Endpoints
- `POST /whatsapp` - Main webhook for receiving WhatsApp messages
- `POST /whatsapp/conversation/clear/:userId` - Clear conversation history for a user

**Note**: WhatsApp message sending is handled by an external service configured via `WHATSAPP_API_URL`.

### Local Development
```bash
npm install          # Install dependencies
npm run dev          # Start with hot reload (nodemon + ts-node)
npm run build        # Compile TypeScript to dist/
npm start            # Run compiled production build
```

## Architecture

### High-Level Overview
```mermaid
graph TB
    WA[WhatsApp Client] -->|HTTP POST| WHC[WhatsApp Controller]
    WHC --> AMS[AI Message Service]
    AMS --> GS[Gemini Service]
    GS --> FDS[Function Declaration Service]
    FDS --> TS[Transaction Service]
    FDS --> RTS[Recurring Transaction Service]
    FDS --> FTS[Freeform Transaction Search]
    TS --> PR[Prisma Client]
    RTS --> PR
    FTS --> MQL[MongoDB Query Service]
    FTS --> TES[Transaction Embedding Service]
    TES --> QD[Qdrant]
    TES --> EMB[Embedder/Gemini]
    PR --> MDB[(MongoDB)]
    MQL --> MDB
    AMS --> CS[Conversation Service]
    CS --> PR
    WHC --> WHS[WhatsApp Service]
    WHS -->|Send Reply| WAAPI[External WhatsApp API]
```

### Service Layers

**Controllers** (`src/controllers/`)
- `WhatsAppController`: Handles webhook requests, validates payloads, orchestrates AI message processing

**Services - AI** (`src/services/ai/`)
- **Conversational**:
  - `AIMessageService`: Orchestrates iterative function calling loop (up to max iterations)
  - `GeminiService`: Direct interface to Google Gemini API
  - `FunctionDeclarationService`: Defines available functions and executes them
- **Embedding**:
  - `Embedder`: Wraps Gemini embedding API
  - `QdrantService`: Vector storage and retrieval
  - `TransactionEmbeddingService`: Stores/searches transaction embeddings

**Services - Business** (`src/services/business/`)
- `TransactionService`: Core transaction CRUD operations (add, edit, delete)
- `RecurringTransactionService`: Recurring transaction management
- `CategoryClassificationService`: AI-powered category assignment
- `TransactionLookupService`: Find transactions by various criteria
- `FreeformTransactionSearchService`: Semantic + MongoDB aggregation queries
- `MqlTransactionSearchService`: MongoDB aggregation pipeline execution

**Services - Infrastructure** (`src/services/infrastructure/`)
- `ConversationService`: Persist and retrieve conversation history
- `WhatsAppService`: Send messages to external WhatsApp API
- `DeletionStateService`: Manage deletion confirmation state
- `PrismaClientManager`: Singleton Prisma client
- `MongoConnectionManager`: MongoDB connection management

**Domain Objects** (`src/domain/`)
- `RecurrencePattern`: Encapsulates recurrence logic (frequency, next due date calculation)

**Validators** (`src/validators/`)
- `TransactionValidator`: Validate transaction data (never throws, returns `ValidationResult`)
- `RecurringTransactionValidator`: Validate recurring transaction data

**Utilities** (`src/lib/`)
- `CategoryNormalizer`: Fuzzy match categories based on transaction type
- `DateNormalizer`: Parse natural language dates using chrono-node
- `MessageBuilder`: Format user-friendly success messages
- `TransactionEmbeddingHelpers`: Generate text for embeddings
- `WhatsAppPostProcessor`: Format responses for WhatsApp

### Key Design Patterns

**Composition Over Inheritance**: Services compose shared utilities (CategoryNormalizer, PrismaClientManager) rather than extending base classes.

**ServiceResult Pattern**: All service methods return `ServiceResult<T>` with structured success/failure states. Validators return `ValidationResult` objects instead of throwing exceptions.

**Dependency Injection**: `DependencyService` singleton initializes and wires all services at startup.

**Repository Pattern**: Database access abstracted through repositories (though some services directly use Prisma).

**AI Function Calling Loop**: AIMessageService maintains conversation history as `Content[]` array, iteratively calling Gemini until no more function calls are returned.

### Data Models (Prisma Schema)

**Transaction**: One-time expense or income
- Fields: id, userId, date (ISO string), amount, category, description, type
- Optional link to recurring transaction via `recurringTransactionId`

**RecurringTransaction**: Recurring expense or income
- Fields: id, userId, amount, category, description, type
- Recurrence: frequency, interval, dayOfWeek, dayOfMonth, monthOfYear
- Status: isActive, nextDue (ISO string)

**Conversation**: User conversation history
- Fields: id, userId, createdAt, updatedAt
- Relation: One-to-many with Message

**Message**: Individual message in conversation
- Fields: id, conversationId, role (user/model), content (JSON stringified)

### Error Handling

Custom error hierarchy in `src/errors/ApplicationError.ts`:
- `ApplicationError`: Base class with code, statusCode, details, timestamp
- `ValidationError` (400): Input validation failures
- `DatabaseError` (500): Prisma/MongoDB errors

TODO: Confirm if error classes are fully implemented and used consistently across services.
