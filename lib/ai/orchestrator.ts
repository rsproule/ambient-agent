/**
 * AI Orchestrator
 *
 * Determines what action to take with an incoming message
 */

import { createOpenAI } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { z } from "zod";
import type { AgentDecision, MessageContext } from "./types";

const decisionSchema = z.object({
  action: z.enum(["direct_respond", "skip"]).describe("The action to take"),
  reasoning: z.string().describe("The reasoning behind this decision"),
  confidence: z.number().min(0).max(1).describe("Confidence level (0-1)"),
});

const echo = createOpenAI({
  apiKey: process.env.ECHO_API_KEY,
  baseURL: "https://echo.router.merit.systems",
});

export class AIOrchestrator {
  private model;

  constructor() {
    this.model = echo("gpt-5-nano");
  }

  /**
   * Analyze a message and decide what action to take
   */
  async decideAction(context: MessageContext): Promise<AgentDecision> {
    const prompt = `You are an AI orchestrator that analyzes incoming messages and decides how to respond.

Message Details:
- Sender: ${context.sender}
- Text: ${context.text}
${context.groupId ? `- Group ID: ${context.groupId}` : ""}

Available Actions:
1. direct_respond: Generate an AI response and send it back
2. skip: Don't respond to this message

Analyze the message and decide which action to take. Consider:
- Is this a meaningful message that warrants a response?
- Does it seem like spam or a system message?
- Is it a question or statement that needs addressing?

Provide your decision with reasoning and confidence level.`;

    const result = await generateObject({
      model: this.model,
      schema: decisionSchema,
      prompt,
      temperature: 0.3,
    });

    return result.object as AgentDecision;
  }
}
