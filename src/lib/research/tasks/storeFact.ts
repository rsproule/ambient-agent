import {
  addContextDocument,
  markRelatedDocumentsStale,
  mergeFacts,
} from "@/src/db/userContext";
import {
  combineTextsForEmbedding,
  generateEmbedding,
  prepareTextForEmbedding,
} from "@/src/lib/embeddings";

/**
 * Store a fact from conversation and optionally invalidate related documents
 */
export async function storeFact(
  userId: string,
  content: string,
  invalidates?: string[],
): Promise<{
  success: boolean;
  documentsCreated: number;
  documentsInvalidated: number;
  error?: string;
}> {
  try {
    let documentsInvalidated = 0;

    // If we have invalidation queries, find and mark related docs as stale
    if (invalidates && invalidates.length > 0) {
      for (const query of invalidates) {
        // Generate embedding for the invalidation query
        const queryEmbedding = await generateEmbedding(
          prepareTextForEmbedding(query),
        );

        // Mark related documents as stale
        const invalidatedCount = await markRelatedDocumentsStale(
          userId,
          queryEmbedding,
          0.75, // Threshold for similarity
        );

        documentsInvalidated += invalidatedCount;
      }
    }

    // Store the new fact as a context document
    const documentContent = combineTextsForEmbedding({
      title: "User Statement",
      content,
      metadata: {
        Source: "conversation",
        Type: "direct statement",
      },
    });

    const embedding = await generateEmbedding(
      prepareTextForEmbedding(documentContent),
    );

    await addContextDocument(userId, {
      source: "conversation",
      title: "User Statement",
      content: documentContent,
      embedding,
    });

    // Also add to the facts array for quick access
    await mergeFacts(userId, [
      {
        content,
        source: "conversation",
        timestamp: new Date().toISOString(),
      },
    ]);

    return {
      success: true,
      documentsCreated: 1,
      documentsInvalidated,
    };
  } catch (error) {
    console.error("Error storing fact:", error);
    return {
      success: false,
      documentsCreated: 0,
      documentsInvalidated: 0,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Store multiple facts at once
 */
export async function storeFacts(
  userId: string,
  facts: Array<{
    content: string;
    invalidates?: string[];
  }>,
): Promise<{
  success: boolean;
  documentsCreated: number;
  documentsInvalidated: number;
  errors: string[];
}> {
  let totalCreated = 0;
  let totalInvalidated = 0;
  const errors: string[] = [];

  for (const fact of facts) {
    const result = await storeFact(userId, fact.content, fact.invalidates);

    if (result.success) {
      totalCreated += result.documentsCreated;
      totalInvalidated += result.documentsInvalidated;
    } else if (result.error) {
      errors.push(result.error);
    }
  }

  return {
    success: errors.length === 0,
    documentsCreated: totalCreated,
    documentsInvalidated: totalInvalidated,
    errors,
  };
}


