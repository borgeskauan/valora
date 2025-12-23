import dotenv from 'dotenv';
import { SYSTEM_INSTRUCTION } from './systemInstruction';

dotenv.config();

export const config = {
  port: process.env.PORT || 3001,
  geminiApiKey: process.env.GEMINI_API_KEY,
  geminiModel: process.env.GEMINI_MODEL || 'gemini-2.0-flash',
  systemInstruction: SYSTEM_INSTRUCTION,
  databaseUrl: process.env.DATABASE_URL,
  qdrantUrl: process.env.QDRANT_URL || 'http://localhost:6333',
  embeddingThreshold: parseFloat(process.env.EMBEDDING_THRESHOLD || '0.8'),
  whatsapp: {
    apiUrl: process.env.WHATSAPP_API_URL || 'http://localhost:3000'
  },
  deletion: {
    confirmationWindowSeconds: parseInt(process.env.DELETION_CONFIRMATION_WINDOW || '120', 10)
  }
};