import { addContextDocument, updateUserContext } from "@/src/db/userContext";
import {
  combineTextsForEmbedding,
  generateEmbedding,
  prepareTextForEmbedding,
} from "@/src/lib/embeddings";
import { listCalendarEvents } from "@/src/lib/integrations/calendar";
import {
  getGitHubUser,
  listGitHubRepos,
  type GitHubRepo,
} from "@/src/lib/integrations/github";
import {
  getGmailMessage,
  listGmailMessages,
} from "@/src/lib/integrations/gmail";
import { openai } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { z } from "zod";

type Provider = "gmail" | "github" | "calendar";

/**
 * Analyze a provider's data and extract user context
 */
export async function analyzeProvider(
  userId: string,
  provider: Provider,
): Promise<{
  success: boolean;
  documentsCreated: number;
  summary?: string;
  error?: string;
}> {
  try {
    switch (provider) {
      case "gmail":
        return await analyzeGmail(userId);
      case "github":
        return await analyzeGitHub(userId);
      case "calendar":
        return await analyzeCalendar(userId);
      default:
        return {
          success: false,
          documentsCreated: 0,
          error: `Unknown provider: ${provider}`,
        };
    }
  } catch (error) {
    console.error(`Error analyzing ${provider}:`, error);
    return {
      success: false,
      documentsCreated: 0,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Analyze Gmail data
 */
async function analyzeGmail(userId: string): Promise<{
  success: boolean;
  documentsCreated: number;
  summary?: string;
  error?: string;
}> {
  // Get recent messages
  const messagesResponse = await listGmailMessages(userId, { maxResults: 50 });
  const messageIds =
    messagesResponse.messages?.map((m) => m.id).filter(Boolean) || [];

  if (messageIds.length === 0) {
    return { success: true, documentsCreated: 0, summary: "No emails found" };
  }

  // Fetch message details (limit to avoid rate limits)
  const messagesToFetch = messageIds.slice(0, 20);
  const messages = await Promise.all(
    messagesToFetch.map((id) => getGmailMessage(userId, id!)),
  );

  // Extract senders and subjects for analysis
  const emailData = messages.map((msg) => {
    const headers = msg.payload?.headers || [];
    const from = headers.find((h) => h.name === "From")?.value || "";
    const subject = headers.find((h) => h.name === "Subject")?.value || "";
    const snippet = msg.snippet || "";
    return { from, subject, snippet };
  });

  // Use AI to extract patterns
  const { object: analysis } = await generateObject({
    model: openai("gpt-4o-mini"),
    schema: z.object({
      frequentContacts: z
        .array(z.string())
        .describe("Names/emails of frequent contacts"),
      topics: z.array(z.string()).describe("Common topics or themes"),
      communicationStyle: z
        .string()
        .optional()
        .describe("Communication style insights"),
      professionalContext: z
        .string()
        .optional()
        .describe("Work/professional context"),
    }),
    prompt: `Analyze these email snippets and extract insights about the user:
${emailData
  .map((e) => `From: ${e.from}\nSubject: ${e.subject}\nSnippet: ${e.snippet}`)
  .join("\n\n")}

Extract:
1. Frequent contacts (people they email often)
2. Common topics/themes
3. Communication style (formal/casual, etc)
4. Any professional context (job, company, etc)`,
  });

  // Create context document
  const content = combineTextsForEmbedding({
    title: "Gmail Communication Analysis",
    content: JSON.stringify(analysis, null, 2),
    metadata: {
      "Email count analyzed": String(messages.length),
      "Frequent contacts": analysis.frequentContacts.join(", "),
      Topics: analysis.topics.join(", "),
    },
  });

  const embedding = await generateEmbedding(prepareTextForEmbedding(content));

  await addContextDocument(userId, {
    source: "gmail",
    title: "Gmail Communication Patterns",
    content,
    embedding,
  });

  // Update user context
  if (analysis.topics.length > 0) {
    await updateUserContext(userId, {
      interests: analysis.topics,
    });
  }

  return {
    success: true,
    documentsCreated: 1,
    summary: `Analyzed ${messages.length} emails. Found ${analysis.topics.length} topics.`,
  };
}

/**
 * Analyze GitHub data
 */
async function analyzeGitHub(userId: string): Promise<{
  success: boolean;
  documentsCreated: number;
  summary?: string;
  error?: string;
}> {
  // Get user profile and repos
  const [user, repos] = await Promise.all([
    getGitHubUser(userId),
    listGitHubRepos(userId, { sort: "updated", perPage: 20 }),
  ]);

  // Extract programming languages
  const languages = new Set<string>();
  repos.forEach((repo: GitHubRepo) => {
    if (repo.language) languages.add(repo.language);
  });

  // Use AI to extract professional context
  const { object: analysis } = await generateObject({
    model: openai("gpt-4o-mini"),
    schema: z.object({
      role: z.string().optional().describe("Likely job role/title"),
      expertise: z.array(z.string()).describe("Areas of expertise"),
      interests: z.array(z.string()).describe("Technical interests"),
      summary: z.string().describe("Brief professional summary"),
    }),
    prompt: `Analyze this GitHub profile and extract professional insights:

User: ${user.name || user.login}
Bio: ${user.bio || "N/A"}
Company: ${user.company || "N/A"}
Location: ${user.location || "N/A"}
Public repos: ${user.public_repos}
Followers: ${user.followers}

Recent repositories:
${repos
  .slice(0, 10)
  .map(
    (r: GitHubRepo) =>
      `- ${r.name}: ${r.description || "No description"} (${
        r.language || "Unknown"
      })`,
  )
  .join("\n")}

Languages used: ${Array.from(languages).join(", ")}

Extract professional insights about this person.`,
  });

  // Create context document
  const content = combineTextsForEmbedding({
    title: "GitHub Profile Analysis",
    content: JSON.stringify(
      {
        username: user.login,
        name: user.name,
        bio: user.bio,
        company: user.company,
        location: user.location,
        languages: Array.from(languages),
        repoCount: repos.length,
        analysis,
      },
      null,
      2,
    ),
    metadata: {
      "GitHub username": user.login,
      Languages: Array.from(languages).join(", "),
      Expertise: analysis.expertise.join(", "),
    },
  });

  const embedding = await generateEmbedding(prepareTextForEmbedding(content));

  await addContextDocument(userId, {
    source: "github",
    sourceUrl: user.html_url,
    title: `GitHub: ${user.name || user.login}`,
    content,
    embedding,
  });

  // Update user context
  await updateUserContext(userId, {
    professional: {
      github: {
        username: user.login,
        name: user.name,
        company: user.company,
        role: analysis.role,
      },
    },
    interests: [...analysis.interests, ...analysis.expertise],
  });

  return {
    success: true,
    documentsCreated: 1,
    summary: analysis.summary,
  };
}

/**
 * Analyze Calendar data
 */
async function analyzeCalendar(userId: string): Promise<{
  success: boolean;
  documentsCreated: number;
  summary?: string;
  error?: string;
}> {
  // Get upcoming and recent events
  const now = new Date();
  const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
  const twoWeeksFromNow = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

  const events = await listCalendarEvents(userId, {
    timeMin: twoWeeksAgo,
    timeMax: twoWeeksFromNow,
    maxResults: 50,
  });

  const eventList = events.items || [];

  if (eventList.length === 0) {
    return {
      success: true,
      documentsCreated: 0,
      summary: "No calendar events found",
    };
  }

  // Extract event data for analysis
  const eventData = eventList.map((event) => ({
    summary: event.summary || "Untitled",
    start: event.start?.dateTime || event.start?.date,
    attendees: event.attendees?.length || 0,
    organizer: event.organizer?.email,
  }));

  // Use AI to extract patterns
  const { object: analysis } = await generateObject({
    model: openai("gpt-4o-mini"),
    schema: z.object({
      meetingTypes: z.array(z.string()).describe("Types of meetings"),
      workStyle: z.string().optional().describe("Work style insights"),
      frequentCollaborators: z
        .array(z.string())
        .describe("Frequent meeting attendees"),
      schedule: z.string().optional().describe("Schedule patterns"),
    }),
    prompt: `Analyze this calendar data and extract insights:

Events:
${eventData
  .map((e) => `- ${e.summary} (${e.start}, ${e.attendees} attendees)`)
  .join("\n")}

Extract:
1. Types of meetings (1:1s, team meetings, external calls, etc)
2. Work style insights
3. Frequent collaborators
4. Schedule patterns (busy times, focus blocks, etc)`,
  });

  // Create context document
  const content = combineTextsForEmbedding({
    title: "Calendar Analysis",
    content: JSON.stringify(analysis, null, 2),
    metadata: {
      "Events analyzed": String(eventList.length),
      "Meeting types": analysis.meetingTypes.join(", "),
    },
  });

  const embedding = await generateEmbedding(prepareTextForEmbedding(content));

  await addContextDocument(userId, {
    source: "calendar",
    title: "Calendar Patterns",
    content,
    embedding,
  });

  return {
    success: true,
    documentsCreated: 1,
    summary: `Analyzed ${eventList.length} events. ${analysis.workStyle || ""}`,
  };
}
