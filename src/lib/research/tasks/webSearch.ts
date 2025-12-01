import { addContextDocuments, updateUserContext } from "@/src/db/userContext";
import {
  combineTextsForEmbedding,
  generateEmbeddings,
  prepareTextForEmbedding,
} from "@/src/lib/embeddings";
import { openai } from "@ai-sdk/openai";
import { perplexity } from "@ai-sdk/perplexity";
import { generateObject, generateText } from "ai";
import { z } from "zod";

/**
 * Person info extracted from web search
 */
interface PersonInfo {
  name?: string;
  role?: string;
  company?: string;
  previousRoles?: string[];
  location?: string;
  education?: string;
  bio?: string;
  expertise?: string[];
  socialProfiles?: string[];
  linkedinUrl?: string;
  twitterHandle?: string;
  githubUsername?: string;
  personalWebsite?: string;
}

/**
 * Run web searches and store results as context documents
 * Does comprehensive research with multiple queries and synthesizes findings
 */
export async function runWebSearch(
  userId: string,
  queries: string[],
): Promise<{
  success: boolean;
  documentsCreated: number;
  findings?: string[];
  professionalSummary?: string;
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
    const allPersonInfo: PersonInfo[] = [];

    // Run each search query
    for (const query of queries) {
      console.log(`[WebSearch] Searching: "${query}"`);
      const result = await searchAndExtract(query);

      if (result.documents.length > 0) {
        allDocuments.push(...result.documents);
      }

      if (result.summary) {
        findings.push(result.summary);
      }

      if (result.personInfo) {
        allPersonInfo.push(result.personInfo);
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

    // If we found person info, synthesize it and update user context
    let professionalSummary: string | undefined;
    if (allPersonInfo.length > 0) {
      // Use GPT-4o to synthesize all person info into a coherent profile
      const { text: synthesis } = await generateText({
        model: openai("gpt-4o"),
        prompt: `Synthesize the following information about a person into a concise professional summary.
Combine information from multiple sources, resolve any conflicts by preferring more detailed/recent info.

Person information from multiple searches:
${JSON.stringify(allPersonInfo, null, 2)}

Write a 2-3 sentence professional summary that captures:
- Current role and company
- Key expertise/background
- Any notable achievements or characteristics

Be factual and concise.`,
      });

      professionalSummary = synthesis;

      // Extract interests from the person info
      const allExpertise = allPersonInfo
        .flatMap((p) => p.expertise || [])
        .filter(Boolean);

      // Update user context with findings
      const primary = allPersonInfo[0];
      if (primary) {
        await updateUserContext(userId, {
          professional: {
            web: {
              name: primary.name,
              role: primary.role,
              company: primary.company,
              location: primary.location,
              linkedin: primary.linkedinUrl,
              twitter: primary.twitterHandle,
              github: primary.githubUsername,
              website: primary.personalWebsite,
            },
          },
          interests: allExpertise.length > 0 ? allExpertise : undefined,
        });
      }
    }

    return {
      success: true,
      documentsCreated: allDocuments.length,
      findings,
      professionalSummary,
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
 * Uses Perplexity's sonar-pro for deep research
 */
async function searchAndExtract(query: string): Promise<{
  documents: Array<{
    source: string;
    sourceUrl?: string;
    title: string;
    content: string;
  }>;
  summary?: string;
  personInfo?: PersonInfo;
}> {
  // Use Perplexity sonar-pro for deeper, more thorough research
  const { object: searchResult } = await generateObject({
    model: perplexity("sonar-pro"),
    schema: z.object({
      findings: z.array(
        z.object({
          title: z.string().describe("Title or headline"),
          content: z
            .string()
            .describe("Detailed information found - be thorough"),
          source: z.string().optional().describe("Source website/publication"),
          url: z.string().optional().describe("Source URL"),
          relevance: z
            .enum(["high", "medium", "low"])
            .describe("Relevance to query"),
          category: z
            .enum([
              "professional",
              "social",
              "news",
              "company",
              "education",
              "other",
            ])
            .describe("Type of information"),
        }),
      ),
      summary: z.string().describe("Comprehensive summary of all findings"),
      personInfo: z
        .object({
          name: z.string().optional(),
          role: z.string().optional().describe("Current job title"),
          company: z.string().optional().describe("Current employer"),
          previousRoles: z
            .array(z.string())
            .optional()
            .describe("Past positions"),
          location: z.string().optional(),
          education: z.string().optional(),
          bio: z.string().optional().describe("Detailed bio/background"),
          expertise: z
            .array(z.string())
            .optional()
            .describe("Areas of expertise"),
          socialProfiles: z.array(z.string()).optional(),
          linkedinUrl: z.string().optional(),
          twitterHandle: z.string().optional(),
          githubUsername: z.string().optional(),
          personalWebsite: z.string().optional(),
        })
        .optional()
        .describe("Extracted person information - be thorough"),
      companyInfo: z
        .object({
          name: z.string().optional(),
          description: z.string().optional(),
          industry: z.string().optional(),
          size: z.string().optional(),
          founded: z.string().optional(),
          headquarters: z.string().optional(),
          website: z.string().optional(),
        })
        .optional()
        .describe("If searching for a company, extracted info"),
    }),
    prompt: `Conduct thorough research on: "${query}"

Search comprehensively for:
1. Professional background - current and past roles, companies, responsibilities
2. Public profiles - LinkedIn, Twitter/X, GitHub, personal website, blog
3. News mentions, interviews, podcast appearances, conference talks
4. Publications, patents, or notable projects
5. Education and credentials
6. Company information if relevant
7. Any other publicly available information

Be thorough and extract as much relevant detail as possible. Include URLs where available.
If this appears to be a person's name, focus on building a complete professional profile.
If this is a company or domain, extract company information.`,
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
          Category: finding.category,
        },
      }),
    }));

  // If we found person info, create a dedicated document for it
  if (
    searchResult.personInfo &&
    Object.keys(searchResult.personInfo).length > 0
  ) {
    const personInfo = searchResult.personInfo;
    documents.push({
      source: "web",
      sourceUrl: personInfo.linkedinUrl || personInfo.personalWebsite,
      title: `Profile: ${personInfo.name || query}`,
      content: combineTextsForEmbedding({
        title: `Web Profile: ${personInfo.name || query}`,
        content: JSON.stringify(personInfo, null, 2),
        metadata: {
          "Search query": query,
          "Current role": personInfo.role || "Unknown",
          Company: personInfo.company || "Unknown",
        },
      }),
    });
  }

  // If we found company info, create a dedicated document for it
  if (
    searchResult.companyInfo &&
    Object.keys(searchResult.companyInfo).length > 0
  ) {
    documents.push({
      source: "web",
      sourceUrl: searchResult.companyInfo.website,
      title: `Company: ${searchResult.companyInfo.name || query}`,
      content: combineTextsForEmbedding({
        title: `Company Profile: ${searchResult.companyInfo.name || query}`,
        content: JSON.stringify(searchResult.companyInfo, null, 2),
        metadata: {
          "Search query": query,
          Industry: searchResult.companyInfo.industry || "Unknown",
        },
      }),
    });
  }

  return {
    documents,
    summary: searchResult.summary,
    personInfo: searchResult.personInfo,
  };
}

/**
 * Search for a specific person with comprehensive queries
 */
export async function searchPerson(
  userId: string,
  name: string,
  additionalContext?: {
    email?: string;
    company?: string;
    location?: string;
  },
): Promise<{
  success: boolean;
  documentsCreated: number;
  summary?: string;
  professionalSummary?: string;
  error?: string;
}> {
  const queries: string[] = [];

  // Primary query - just the name
  queries.push(name);

  // Add company context if available
  if (additionalContext?.company) {
    queries.push(`${name} ${additionalContext.company}`);
  }

  // LinkedIn specific search
  queries.push(`${name} LinkedIn`);

  // Search with email domain for company info
  if (additionalContext?.email) {
    const domain = additionalContext.email.split("@")[1];
    if (
      domain &&
      ![
        "gmail.com",
        "yahoo.com",
        "hotmail.com",
        "outlook.com",
        "icloud.com",
      ].includes(domain)
    ) {
      queries.push(`${domain} company`);
      // Also search person + domain
      queries.push(`${name} ${domain}`);
    }
  }

  // Add location context if available
  if (additionalContext?.location) {
    queries.push(`${name} ${additionalContext.location}`);
  }

  // Dedupe queries
  const uniqueQueries = [...new Set(queries)];

  return runWebSearch(userId, uniqueQueries);
}

/**
 * Deep research on a person - runs multiple specialized searches
 */
export async function deepResearchPerson(
  userId: string,
  name: string,
  context?: {
    email?: string;
    company?: string;
    role?: string;
    location?: string;
  },
): Promise<{
  success: boolean;
  documentsCreated: number;
  professionalSummary?: string;
  error?: string;
}> {
  const queries: string[] = [];

  // Core identity queries
  queries.push(name);
  queries.push(`"${name}" professional`);

  // Social/professional profile queries
  queries.push(`${name} LinkedIn profile`);
  queries.push(`${name} Twitter OR X`);

  // Add context-enriched queries
  if (context?.company) {
    queries.push(`${name} ${context.company}`);
    queries.push(`${context.company} team`);
  }

  if (context?.role) {
    queries.push(`${name} ${context.role}`);
  }

  if (context?.email) {
    const domain = context.email.split("@")[1];
    const personalDomains = [
      "gmail.com",
      "yahoo.com",
      "hotmail.com",
      "outlook.com",
      "icloud.com",
      "me.com",
    ];

    if (domain && !personalDomains.includes(domain)) {
      queries.push(`${domain} company about`);
      queries.push(`${name} site:${domain}`);
    }
  }

  // News and publications
  queries.push(`${name} interview OR podcast OR talk`);

  // Dedupe and limit
  const uniqueQueries = [...new Set(queries)].slice(0, 8);

  console.log(
    `[DeepResearch] Running ${uniqueQueries.length} queries for ${name}`,
  );

  return runWebSearch(userId, uniqueQueries);
}
