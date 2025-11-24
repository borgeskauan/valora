import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

export class Embedder {
  private ai: GoogleGenAI;

  constructor(apiKey?: string) {
    this.ai = new GoogleGenAI({ apiKey: apiKey ?? process.env.GOOGLE_API_KEY });
  }

  async embedText(text: string): Promise<number[]> {
    if (!text) throw new Error("empty text");

    const response = await this.ai.models.embedContent({
      model: "gemini-embedding-001",
      contents: [text],
      config: { taskType: "SEMANTIC_SIMILARITY" },
    });

    // defensive parsing
    const embeddings: number[][] = (response as any).embeddings?.map((e: any) => e.values) ?? [];
    if (embeddings.length === 0 || !Array.isArray(embeddings[0])) {
      throw new Error("embedding generation failed: unexpected response");
    }

    return embeddings[0];
  }
}
