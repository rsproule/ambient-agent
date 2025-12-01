import { addContextDocuments } from "@/src/db/userContext";
import {
  combineTextsForEmbedding,
  generateEmbeddings,
  prepareTextForEmbedding,
} from "@/src/lib/embeddings";
import { perplexity } from "@ai-sdk/perplexity";
import { generateObject } from "ai";
import { z } from "zod";

/**
 * Run web searches and store results as context documents
 */
export async function runWebSearch(
  userId: string,
  queries: string[],
): Promise<{
  success: boolean;
  documentsCreated: number;
  findings?: string[];
  error?: string;
}> {
  if (queries.length === 0) {
    return { success: true, documentsCreated: 0, findings: [] };
  }

  try {
    const allDocuments: Array<{
      source: string;
      sourceUrl?: string;
      title: string;
      content: string;
      embedding?: number[];
    }> = [];

    const findings: string[] = [];

    // Run each search query
    for (const query of queries) {
      const result = await searchAndExtract(query);

      if (result.documents.length > 0) {
        allDocuments.push(...result.documents);
      }

      if (result.summary) {
        findings.push(result.summary);
      }
    }

    // Generate embeddings in batch
    if (allDocuments.length > 0) {
      const textsToEmbed = allDocuments.map((doc) =>
        prepareTextForEmbedding(doc.content),
      );
      const embeddings = await generateEmbeddings(textsToEmbed);

      // Add embeddings to documents
      allDocuments.forEach((doc, i) => {
        doc.embedding = embeddings[i];
      });

      // Store all documents
      await addContextDocuments(userId, allDocuments);
    }

    return {
      success: true,
      documentsCreated: allDocuments.length,
      findings,
    };
  } catch (error) {
    console.error("Error in web search:", error);
    return {
      success: false,
      documentsCreated: 0,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Search the web and extract structured information
 */
async function searchAndExtract(query: string): Promise<{
  documents: Array<{
    source: string;
    sourceUrl?: string;
    title: string;
    content: string;
  }>;
  summary?: string;
}> {
  // Use Perplexity to search and get grounded results
  const { object: searchResult } = await generateObject({
    model: perplexity("sonar"),
    schema: z.object({
      findings: z.array(
        z.object({
          title: z.string().describe("Title or headline"),
          content: z.string().describe("Key information found"),
          source: z.string().optional().describe("Source website/publication"),
          url: z.string().optional().describe("Source URL"),
          relevance: z
            .enum(["high", "medium", "low"])
            .describe("Relevance to query"),
        }),
      ),
      summary: z.string().describe("Brief summary of findings"),
      personInfo: z
        .object({
          name: z.string().optional(),
          role: z.string().optional(),
          company: z.string().optional(),
          location: z.string().optional(),
          bio: z.string().optional(),
          socialProfiles: z.array(z.string()).optional(),
        })
        .optional()
        .describe("If searching for a person, extracted info"),
    }),
    prompt: `Search for and extract information about: "${query}"

Look for:
- Professional background
- Public profiles (LinkedIn, Twitter, personal site)
- News mentions or articles
- Company information
- Any other relevant public information

Return structured findings with sources.`,
  });

  const documents = searchResult.findings
    .filter((f) => f.relevance !== "low")
    .map((finding) => ({
      source: "web",
      sourceUrl: finding.url,
      title: finding.title,
      content: combineTextsForEmbedding({
        title: finding.title,
        content: finding.content,
        metadata: {
          Source: finding.source || "Web search",
          Query: query,
        },
      }),
    }));

  // If we found person info, create a dedicated document for it
  if (
    searchResult.personInfo &&
    Object.keys(searchResult.personInfo).length > 0
  ) {
    documents.push({
      source: "web",
      sourceUrl: undefined,
      title: `Profile: ${searchResult.personInfo.name || query}`,
      content: combineTextsForEmbedding({
        title: `Web Profile: ${searchResult.personInfo.name || query}`,
        content: JSON.stringify(searchResult.personInfo, null, 2),
        metadata: {
          "Search query": query,
        },
      }),
    });
  }

  return {
    documents,
    summary: searchResult.summary,
  };
}

/**
 * Search for a specific person
 */
export async function searchPerson(
  userId: string,
  name: string,
  additionalContext?: {
    email?: string;
    company?: string;
  },
): Promise<{
  success: boolean;
  documentsCreated: number;
  summary?: string;
  error?: string;
}> {
  const queries: string[] = [name];

  // Add contextual queries
  if (additionalContext?.company) {
    queries.push(`${name} ${additionalContext.company}`);
  }

  // Search with email domain for company info
  if (additionalContext?.email) {
    const domain = additionalContext.email.split("@")[1];
    if (
      domain &&
      !["gmail.com", "yahoo.com", "hotmail.com", "outlook.com"].includes(domain)
    ) {
      queries.push(`${domain} company`);
    }
  }

  return runWebSearch(userId, queries);
}
