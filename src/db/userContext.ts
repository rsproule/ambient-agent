import prisma from "@/src/db/client";
import type { Prisma } from "@/src/generated/prisma";

// ============================================
// Types
// ============================================

export interface UserContext {
  id: string;
  userId: string;
  timezone: string | null;
  summary: string | null;
  facts: unknown[] | null;
  interests: string[];
  professional: Record<string, unknown> | null;
  lastUpdatedAt: Date;
  createdAt: Date;
}

export interface ContextDocument {
  id: string;
  contextId: string;
  source: string;
  sourceUrl: string | null;
  title: string;
  content: string;
  isStale: boolean;
  createdAt: Date;
}

export interface CreateContextDocumentInput {
  source: string;
  sourceUrl?: string;
  title: string;
  content: string;
  embedding?: number[];
}

export interface UserContextWithDocs extends UserContext {
  documents: ContextDocument[];
}

// ============================================
// UserContext CRUD
// ============================================

/**
 * Get or create user context
 */
export async function getOrCreateUserContext(
  userId: string,
): Promise<UserContext> {
  let context = await prisma.userContext.findUnique({
    where: { userId },
  });

  if (!context) {
    context = await prisma.userContext.create({
      data: { userId },
    });
  }

  return formatUserContext(context);
}

/**
 * Get user context by userId
 */
export async function getUserContext(
  userId: string,
): Promise<UserContext | null> {
  const context = await prisma.userContext.findUnique({
    where: { userId },
  });

  return context ? formatUserContext(context) : null;
}

/**
 * Get user context by phone number
 */
export async function getUserContextByPhone(
  phoneNumber: string,
): Promise<UserContextWithDocs | null> {
  const user = await prisma.user.findUnique({
    where: { phoneNumber },
    include: {
      userContext: {
        include: {
          documents: {
            where: { isStale: false },
            orderBy: { createdAt: "desc" },
          },
        },
      },
    },
  });

  if (!user?.userContext) {
    return null;
  }

  return {
    ...formatUserContext(user.userContext),
    documents: user.userContext.documents.map(formatContextDocument),
  };
}

/**
 * Update user context
 */
export async function updateUserContext(
  userId: string,
  updates: {
    timezone?: string;
    summary?: string;
    facts?: unknown[];
    interests?: string[];
    professional?: Record<string, unknown>;
  },
): Promise<UserContext> {
  const context = await prisma.userContext.upsert({
    where: { userId },
    create: {
      userId,
      timezone: updates.timezone,
      summary: updates.summary,
      facts: updates.facts as Prisma.InputJsonValue | undefined,
      interests: updates.interests || [],
      professional: updates.professional as Prisma.InputJsonValue | undefined,
      lastUpdatedAt: new Date(),
    },
    update: {
      ...(updates.timezone !== undefined && { timezone: updates.timezone }),
      ...(updates.summary !== undefined && { summary: updates.summary }),
      ...(updates.facts !== undefined && {
        facts: updates.facts as Prisma.InputJsonValue,
      }),
      ...(updates.interests !== undefined && { interests: updates.interests }),
      ...(updates.professional !== undefined && {
        professional: updates.professional as Prisma.InputJsonValue,
      }),
      lastUpdatedAt: new Date(),
    },
  });

  return formatUserContext(context);
}

/**
 * Merge new facts into existing facts
 */
export async function mergeFacts(
  userId: string,
  newFacts: unknown[],
): Promise<UserContext> {
  const existing = await getOrCreateUserContext(userId);
  const existingFacts = (existing.facts as unknown[]) || [];
  const mergedFacts = [...existingFacts, ...newFacts];

  return updateUserContext(userId, { facts: mergedFacts });
}

/**
 * Append interests (deduped)
 */
export async function appendInterests(
  userId: string,
  newInterests: string[],
): Promise<UserContext> {
  const existing = await getOrCreateUserContext(userId);
  const uniqueInterests = [
    ...new Set([...existing.interests, ...newInterests]),
  ];

  return updateUserContext(userId, { interests: uniqueInterests });
}

// ============================================
// ContextDocument CRUD
// ============================================

/**
 * Add a document to user context
 */
export async function addContextDocument(
  userId: string,
  input: CreateContextDocumentInput,
): Promise<ContextDocument> {
  // Ensure context exists
  const context = await getOrCreateUserContext(userId);

  // Create document - embedding handled separately via raw query
  const doc = await prisma.contextDocument.create({
    data: {
      contextId: context.id,
      source: input.source,
      sourceUrl: input.sourceUrl,
      title: input.title,
      content: input.content,
    },
  });

  // If embedding provided, update with raw query
  if (input.embedding && input.embedding.length > 0) {
    await setDocumentEmbedding(doc.id, input.embedding);
  }

  return formatContextDocument(doc);
}

/**
 * Add multiple documents in a batch
 */
export async function addContextDocuments(
  userId: string,
  inputs: CreateContextDocumentInput[],
): Promise<ContextDocument[]> {
  const context = await getOrCreateUserContext(userId);

  const docs = await prisma.$transaction(
    inputs.map((input) =>
      prisma.contextDocument.create({
        data: {
          contextId: context.id,
          source: input.source,
          sourceUrl: input.sourceUrl,
          title: input.title,
          content: input.content,
        },
      }),
    ),
  );

  // Set embeddings for documents that have them
  await Promise.all(
    docs.map(async (doc, i) => {
      const embedding = inputs[i].embedding;
      if (embedding && embedding.length > 0) {
        await setDocumentEmbedding(doc.id, embedding);
      }
    }),
  );

  return docs.map(formatContextDocument);
}

/**
 * Get documents for a user context
 */
export async function getContextDocuments(
  userId: string,
  options?: {
    source?: string;
    includeStale?: boolean;
    limit?: number;
  },
): Promise<ContextDocument[]> {
  const context = await getUserContext(userId);
  if (!context) return [];

  const docs = await prisma.contextDocument.findMany({
    where: {
      contextId: context.id,
      ...(options?.source && { source: options.source }),
      ...(!options?.includeStale && { isStale: false }),
    },
    orderBy: { createdAt: "desc" },
    take: options?.limit,
  });

  return docs.map(formatContextDocument);
}

/**
 * Mark documents as stale by source
 */
export async function markDocumentsStale(
  userId: string,
  source: string,
): Promise<number> {
  const context = await getUserContext(userId);
  if (!context) return 0;

  const result = await prisma.contextDocument.updateMany({
    where: {
      contextId: context.id,
      source,
      isStale: false,
    },
    data: { isStale: true },
  });

  return result.count;
}

/**
 * Mark documents as stale by semantic similarity
 * Uses vector search to find related documents and mark them stale
 */
export async function markRelatedDocumentsStale(
  userId: string,
  queryEmbedding: number[],
  threshold: number = 0.8,
): Promise<number> {
  const context = await getUserContext(userId);
  if (!context) return 0;

  const vectorStr = toPgVector(queryEmbedding);

  // Find similar documents and mark them stale
  const result = await prisma.$executeRaw`
    UPDATE "ContextDocument"
    SET "isStale" = true
    WHERE "contextId" = ${context.id}
      AND "isStale" = false
      AND embedding IS NOT NULL
      AND 1 - (embedding <=> ${vectorStr}::vector) > ${threshold}
  `;

  return Number(result);
}

/**
 * Delete stale documents older than a certain age
 */
export async function cleanupStaleDocuments(
  userId: string,
  olderThanDays: number = 30,
): Promise<number> {
  const context = await getUserContext(userId);
  if (!context) return 0;

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - olderThanDays);

  const result = await prisma.contextDocument.deleteMany({
    where: {
      contextId: context.id,
      isStale: true,
      createdAt: { lt: cutoff },
    },
  });

  return result.count;
}

// ============================================
// Vector Search
// ============================================

/**
 * Convert a number array to pgvector string format
 * pgvector expects "[0.1,0.2,0.3]" not "{0.1,0.2,0.3}"
 */
function toPgVector(embedding: number[]): string {
  return `[${embedding.join(",")}]`;
}

/**
 * Set embedding for a document using raw SQL (pgvector)
 */
export async function setDocumentEmbedding(
  documentId: string,
  embedding: number[],
): Promise<void> {
  const vectorStr = toPgVector(embedding);
  await prisma.$executeRaw`
    UPDATE "ContextDocument"
    SET embedding = ${vectorStr}::vector
    WHERE id = ${documentId}
  `;
}

/**
 * Find similar documents using vector search
 */
export async function findSimilarDocuments(
  userId: string,
  queryEmbedding: number[],
  options?: {
    limit?: number;
    threshold?: number;
    includeStale?: boolean;
  },
): Promise<(ContextDocument & { similarity: number })[]> {
  const context = await getUserContext(userId);
  if (!context) return [];

  const limit = options?.limit || 5;
  const threshold = options?.threshold || 0.7;
  const includeStale = options?.includeStale || false;
  const vectorStr = toPgVector(queryEmbedding);

  // Use cosine distance for similarity search
  // Note: We use separate queries for stale/non-stale because Prisma's template
  // interpolation doesn't work well with conditional SQL fragments in $queryRaw
  const results = includeStale
    ? await prisma.$queryRaw<
        Array<{
          id: string;
          contextId: string;
          source: string;
          sourceUrl: string | null;
          title: string;
          content: string;
          isStale: boolean;
          createdAt: Date;
          similarity: number;
        }>
      >`
        SELECT 
          id,
          "contextId",
          source,
          "sourceUrl",
          title,
          content,
          "isStale",
          "createdAt",
          1 - (embedding <=> ${vectorStr}::vector) as similarity
        FROM "ContextDocument"
        WHERE "contextId" = ${context.id}
          AND embedding IS NOT NULL
          AND 1 - (embedding <=> ${vectorStr}::vector) > ${threshold}
        ORDER BY embedding <=> ${vectorStr}::vector
        LIMIT ${limit}
      `
    : await prisma.$queryRaw<
        Array<{
          id: string;
          contextId: string;
          source: string;
          sourceUrl: string | null;
          title: string;
          content: string;
          isStale: boolean;
          createdAt: Date;
          similarity: number;
        }>
      >`
        SELECT 
          id,
          "contextId",
          source,
          "sourceUrl",
          title,
          content,
          "isStale",
          "createdAt",
          1 - (embedding <=> ${vectorStr}::vector) as similarity
        FROM "ContextDocument"
        WHERE "contextId" = ${context.id}
          AND embedding IS NOT NULL
          AND "isStale" = false
          AND 1 - (embedding <=> ${vectorStr}::vector) > ${threshold}
        ORDER BY embedding <=> ${vectorStr}::vector
        LIMIT ${limit}
      `;

  return results.map((r) => ({
    id: r.id,
    contextId: r.contextId,
    source: r.source,
    sourceUrl: r.sourceUrl,
    title: r.title,
    content: r.content,
    isStale: r.isStale,
    createdAt: r.createdAt,
    similarity: r.similarity,
  }));
}

/**
 * Get user context with relevant documents based on query
 */
export async function getUserContextWithRelevantDocs(
  phoneNumber: string,
  queryEmbedding?: number[],
  limit: number = 5,
): Promise<{
  context: UserContext | null;
  relevantDocs: ContextDocument[];
} | null> {
  const user = await prisma.user.findUnique({
    where: { phoneNumber },
    select: { id: true },
  });

  if (!user) return null;

  const context = await getUserContext(user.id);
  if (!context) {
    return { context: null, relevantDocs: [] };
  }

  let relevantDocs: ContextDocument[] = [];

  if (queryEmbedding && queryEmbedding.length > 0) {
    // Use vector search
    const results = await findSimilarDocuments(user.id, queryEmbedding, {
      limit,
    });
    relevantDocs = results;
  } else {
    // Fall back to most recent documents
    relevantDocs = await getContextDocuments(user.id, { limit });
  }

  return { context, relevantDocs };
}

// ============================================
// Helpers
// ============================================

function formatUserContext(context: {
  id: string;
  userId: string;
  timezone: string | null;
  summary: string | null;
  facts: unknown;
  interests: string[];
  professional: unknown;
  lastUpdatedAt: Date;
  createdAt: Date;
}): UserContext {
  return {
    id: context.id,
    userId: context.userId,
    timezone: context.timezone,
    summary: context.summary,
    facts: context.facts as unknown[] | null,
    interests: context.interests,
    professional: context.professional as Record<string, unknown> | null,
    lastUpdatedAt: context.lastUpdatedAt,
    createdAt: context.createdAt,
  };
}

function formatContextDocument(doc: {
  id: string;
  contextId: string;
  source: string;
  sourceUrl: string | null;
  title: string;
  content: string;
  isStale: boolean;
  createdAt: Date;
}): ContextDocument {
  return {
    id: doc.id,
    contextId: doc.contextId,
    source: doc.source,
    sourceUrl: doc.sourceUrl,
    title: doc.title,
    content: doc.content,
    isStale: doc.isStale,
    createdAt: doc.createdAt,
  };
}
