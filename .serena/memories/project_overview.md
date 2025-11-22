# Expense Tracker Bot - Project Overview

## Purpose
WhatsApp-based financial tracking bot that uses Google Gemini AI for natural language processing. Users send transaction messages via WhatsApp; Gemini extracts structured data and calls functions to store transactions (expenses or income) in MongoDB database.

## Tech Stack
- **Runtime**: Node.js with TypeScript
- **Build System**: TypeScript Compiler (tsc), CommonJS modules
- **Framework**: Express.js for REST API
- **Database**: MongoDB with Prisma ORM
- **AI**: Google Gemini AI (gemini-2.0-flash) with function calling
- **Development**: nodemon + ts-node for hot reload

## Key Dependencies
- `@google/genai`: Gemini AI integration
- `prisma`: Database ORM with custom output path (`src/generated/prisma`)
- `express`: REST API framework
- `dotenv`: Environment configuration

## Architecture Pattern
**AI Function Calling Pipeline**: WhatsApp → WhatsAppController → AIMessageService (iterative loop) → GeminiService → Function Execution → Response

The system maintains conversation history and supports iterative function calling where Gemini can call multiple functions in sequence to complete complex tasks.

## Database
- MongoDB (connection via DATABASE_URL environment variable)
- Local: `mongodb://localhost:27017/expense-tracker`
- Cloud: MongoDB Atlas `mongodb+srv://...`
- Custom Prisma client output: `src/generated/prisma` (not default `node_modules`)
- Import: `import { PrismaClient } from '../generated/prisma'`
- Models: Transaction, RecurringTransaction, Conversation, Message
- Schema sync: `npx prisma db push` (MongoDB doesn't use traditional migrations)
