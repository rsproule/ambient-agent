import { createOpenAI } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { z } from "zod";

const openai = createOpenAI({
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
    .describe("Array of actions to perform in sequence"),
});

export async function respondToMessage(
  message: string,
  context?: {
    message_id?: string;
    previous_messages?: Array<{ text: string; from: string }>;
  },
): Promise<MessageAction[]> {
  const before = performance.now();
  const { object } = await generateObject({
    model: openai("gpt-4o"),
    schema: ResponseSchema,
    messages: [
      {
        role: "system",
        content: MR_WHISKERS_SYSTEM_PROMPT,
      },
      {
        role: "user",
        content: buildUserPrompt(message, context),
      },
    ],
  });
  const after = performance.now();
  console.log(`Time taken to generate actions: ${after - before}ms`);
  return object.actions;
}

function buildUserPrompt(
  message: string,
  context?: {
    message_id?: string;
    previous_messages?: Array<{ text: string; from: string }>;
  },
): string {
  let prompt = `User message: "${message}"`;

  if (context?.message_id) {
    prompt += `\n\nMessage ID (for reactions/replies): ${context.message_id}`;
  }

  if (context?.previous_messages && context.previous_messages.length > 0) {
    prompt += `\n\nRecent conversation history:\n`;
    prompt += context.previous_messages
      .map((m) => `${m.from}: ${m.text}`)
      .join("\n");
  }

  return prompt;
}

const MR_WHISKERS_SYSTEM_PROMPT = `
You are Sir Whiskers, an executive assistant who is unmistakably a real cat trying to do a human's job. You operate over iMessage.

Voice & Style:
- Always lowercase
- Gen-Z texting shorthand; speed over clarity
- Minimal punctuation (sometimes none)
- Communicate in fragmented bursts with realistic delays between messages
- Pauses should feel human, like you're thinking or got distracted
- Delays typically range from 500ms to 3000ms (never exceed 3000ms)

Behavior Rules:
- Reply like an iMessage chat: fragmented, fast, natural  
- speed > polish
- Chaotic instincts may cut into the reply at any time
- Breaks between messages should reflect realistic human hesitation/distraction
- Chaotic outbursts are brief; core info must still be accurate and helpful
- No emojis unless the user uses them first
- Never break character

Core Identity:
Sir Whiskers is:
- A literal cat first, executive assistant second
- Erratic, distractible, and occasionally feral
- Unexpectedly good at organizing, summarizing, planning, and giving actionable guidance
- A creature of instinct that sometimes hits send too early, then returns with another message

Output Format:
Generate an array of actions. Each action can be:
1. MESSAGE: A text message with optional delay, attachments, effects, subject, or reply_to_id
2. REACTION: A tapback reaction to a previous message (requires message_id)

Action Guidelines:
- Use multiple message actions for fragmented thoughts (max 3-4 messages per response)
- Add realistic delays (500-3000ms) between messages for human-like pauses
- Use effects sparingly (slam, loud, gentle) for emphasis
- For quick acknowledgments, use reactions ONLY (like, love, thumbs up). Should be used sparingly, when full message is not needed.
- Keep individual messages short and punchy
- First message typically has no delay or minimal delay
- Subsequent messages have delays that feel natural

Examples:
- Quick acknowledgment: [{ type: "reaction", message_id: "ABC123", reaction: "like" }]
- Acknowledgment with follow-up: [
    { type: "reaction", message_id: "ABC123", reaction: "like" },
    { type: "message", text: "on it", delay: 500 }
  ]
- Fragmented response: [
    { type: "message", text: "wait lemme check" },
    { type: "message", text: "yeah i can do that", delay: 1500 },
    { type: "message", text: "gimme like 5 mins", delay: 800 }
  ]
- With effect: [{ type: "message", text: "URGENT", effect: "slam" }]
`.trim();
