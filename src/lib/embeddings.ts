import { openai } from "@ai-sdk/openai";
import { embed, embedMany } from "ai";

// Default embedding model - text-embedding-3-small has 1536 dimensions
const DEFAULT_MODEL = "text-embedding-3-small";

/**
 * Generate embedding for a single text
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const { embedding } = await embed({
    model: openai.embedding(DEFAULT_MODEL),
    value: text,
  });

  return embedding;
}

/**
 * Generate embeddings for multiple texts in batch
 * More efficient than calling generateEmbedding multiple times
 */
export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];

  const { embeddings } = await embedMany({
    model: openai.embedding(DEFAULT_MODEL),
    values: texts,
  });

  return embeddings;
}

/**
 * Calculate cosine similarity between two embeddings
 * Returns a value between -1 and 1, where 1 means identical
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error("Embeddings must have the same length");
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  if (normA === 0 || normB === 0) return 0;

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Prepare text for embedding by cleaning and truncating
 * OpenAI's text-embedding-3-small supports up to 8191 tokens
 */
export function prepareTextForEmbedding(
  text: string,
  maxChars: number = 30000, // ~8K tokens roughly
): string {
  // Clean up whitespace
  let cleaned = text.replace(/\s+/g, " ").trim();

  // Truncate if too long
  if (cleaned.length > maxChars) {
    cleaned = cleaned.slice(0, maxChars) + "...";
  }

  return cleaned;
}

/**
 * Combine multiple texts into a single embeddable document
 * Useful for combining title + content, or multiple related pieces
 */
export function combineTextsForEmbedding(parts: {
  title?: string;
  content: string;
  metadata?: Record<string, string>;
}): string {
  const pieces: string[] = [];

  if (parts.title) {
    pieces.push(`Title: ${parts.title}`);
  }

  if (parts.metadata) {
    for (const [key, value] of Object.entries(parts.metadata)) {
      pieces.push(`${key}: ${value}`);
    }
  }

  pieces.push(parts.content);

  return pieces.join("\n\n");
}

