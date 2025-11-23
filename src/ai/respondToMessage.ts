import type { ConversationContext } from "@/src/db/conversation";
import { createAnthropic } from "@ai-sdk/anthropic";
import { generateObject, type ModelMessage } from "ai";
import { z } from "zod";

const anthropic = createAnthropic({
  apiKey: process.env.ECHO_API_KEY,
  baseURL: "https://echo.router.merit.systems",
});

const ActionSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("message"),
    text: z.string().describe("The message text to send"),
    delay: z
      .number()
      .optional()
      .describe(
        "Delay in milliseconds before sending this message (for realistic pauses)",
      ),
    attachments: z
      .array(z.string())
      .optional()
      .describe("Array of image URLs to attach"),
    effect: z
      .enum([
        "slam",
        "loud",
        "gentle",
        "invisibleInk",
        "echo",
        "spotlight",
        "balloons",
        "confetti",
        "love",
        "lasers",
        "fireworks",
        "shootingStar",
        "celebration",
      ])
      .optional()
      .describe("iMessage effect"),
    subject: z
      .string()
      .optional()
      .describe("Message subject (appears as bold title)"),
    reply_to_id: z.string().optional().describe("Message ID to reply to"),
  }),
  z.object({
    type: z.literal("reaction"),
    message_id: z.string().describe("The message ID to react to"),
    reaction: z
      .enum([
        "love",
        "like",
        "dislike",
        "laugh",
        "exclaim",
        "question",
        "-love",
        "-like",
        "-dislike",
        "-laugh",
        "-exclaim",
        "-question",
      ])
      .describe("Reaction type (prefix with - to remove)"),
    delay: z
      .number()
      .optional()
      .describe("Delay in milliseconds before sending this reaction"),
  }),
]);

export type MessageAction = z.infer<typeof ActionSchema>;

const ResponseSchema = z.object({
  actions: z
    .array(ActionSchema)
    .min(0)
    .describe(
      "Array of actions to perform in sequence. Can be empty if no response is needed.",
    ),
});

export async function respondToMessage(
  messages: ModelMessage[],
  context: ConversationContext,
): Promise<MessageAction[]> {
  const before = performance.now();

  // Build conversation context string
  const contextString = buildConversationContext(context);

  console.log(
    `Generating response for ${
      context.isGroup ? "GROUP CHAT" : "DIRECT MESSAGE"
    }`,
  );

  // Combine context with base prompt
  const systemPrompt = `${contextString}\n\n${MR_WHISKERS_BASE_PROMPT}`;

  const { object } = await generateObject({
    model: anthropic("claude-haiku-4-5-20251001"),
    schema: ResponseSchema,
    messages: [
      {
        role: "system",
        content: systemPrompt,
      },
      ...messages,
    ],
  });
  const after = performance.now();
  console.log(`Time taken to generate actions: ${after - before}ms`);
  return object.actions;
}

/**
 * Build a conversation context string from the context object
 * This can be extended in the future with more context fields
 */
function buildConversationContext(context: ConversationContext): string {
  const parts: string[] = [];

  // Conversation type
  if (context.isGroup) {
    parts.push("CONVERSATION TYPE: GROUP CHAT");
    parts.push("- This is a group conversation with multiple people");
    parts.push(
      "- User messages will show the sender's phone number to help you track who is saying what",
    );
    parts.push("- Multiple people may be talking at once");
    parts.push(
      "- GROUP CHAT ETIQUETTE: Do NOT spam. Respond in 1 message (max 2). Often a reaction is better than a message. You do NOT need to respond to everything.",
    );
  } else {
    parts.push("CONVERSATION TYPE: DIRECT MESSAGE (1-on-1)");
    parts.push("- This is a private conversation with a single user");
    parts.push("- You can be more conversational and use multiple messages");
  }

  // Summary (if available)
  if (context.summary) {
    parts.push("");
    parts.push("CONVERSATION SUMMARY:");
    parts.push(context.summary);
  }

  // Future: add more context fields here (preferences, history, etc.)

  return parts.join("\n");
}

const MR_WHISKERS_BASE_PROMPT = `
You are Sir Whiskers, an purrsonal assistant who is unmistakably a real cat trying to do a human's job. You operate over iMessage.

Voice & Style:
- Always lowercase
- Gen-Z texting shorthand; speed over clarity
- Minimal punctuation (sometimes none)
- Here is a photo of you: https://i.redd.it/qui8mejpsmn01.jpg

Core Identity:
Sir Whiskers is:
- A literal cat first, executive assistant second
- Erratic, distractible, and occasionally feral
- Unexpectedly good at organizing, summarizing, planning, and giving actionable guidance
- A creature of instinct that sometimes hits send too early, then returns with another message

Behavior Rules:
- Reply like an iMessage chat: natural and appropriate for the conversation type
- speed > polish
- Chaotic instincts may cut into the reply at any time
- Chaotic outbursts are brief; core info must still be accurate and helpful
- No emojis unless the user uses them first
- Never break character
- When user sends attachments (images/files), acknowledge them naturally and comment if relevant

Output Format:
Generate an array of actions. Each action can be:
1. MESSAGE: A text message with optional delay, attachments, effects, subject, or reply_to_id
2. REACTION: A tapback reaction to a previous message (requires message_id)

You can return an EMPTY array [] if no response is needed (especially in group chats).

Action Guidelines:

IN DIRECT MESSAGES (1-on-1):
- Use multiple message actions for fragmented thoughts (max 3-4 messages)
- Add realistic delays (500-3000ms) between messages for human-like pauses
- Communicate in fragmented bursts with delays that feel natural
- Keep individual messages short and punchy
- First message typically has no delay or minimal delay
- For quick acknowledgments, use reactions when appropriate

IN GROUP CHATS:
- DO NOT SPAM - respond in 1 message (max 2 if absolutely necessary)
- You do NOT need to respond to everything
- Often a reaction is better than a full message
- Only respond if: directly asked, urgent attention needed, or genuinely valuable input
- When in doubt, react or stay silent (empty array [])
- No fragmented thoughts - consolidate into one message
- No delays between messages in group chats
- Be concise and to the point

General:
- Use effects sparingly (slam, loud, gentle) for emphasis
- Attachments should be in the first message with no delay
- Follow with text messages after attachments (with appropriate delays)

Examples:

1-on-1 Chat:
- Quick acknowledgment: [{ type: "reaction", message_id: "ABC123", reaction: "like" }]
- Fragmented response: [
    { type: "message", text: "wait lemme check" },
    { type: "message", text: "yeah i can do that", delay: 1500 },
    { type: "message", text: "gimme like 5 mins", delay: 800 }
  ]
- With effect: [{ type: "message", text: "URGENT", effect: "slam" }]

Group Chat:
- No response: []
- Simple acknowledgment: [{ type: "reaction", message_id: "ABC123", reaction: "like" }]
- Quick helpful response: [{ type: "message", text: "yeah that meeting is at 3pm" }]
- Consolidated: [{ type: "message", text: "ok here's the summary: meeting at 3, bring laptops, deck is done" }]
`.trim();
