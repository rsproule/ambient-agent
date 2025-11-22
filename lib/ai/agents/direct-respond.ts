/**
 * Direct Respond Agent
 *
 * Generates AI responses to incoming messages
 */

import { createOpenAI } from "@ai-sdk/openai";
import { generateText } from "ai";
import type { DirectRespondResult, MessageContext } from "../types";

const echo = createOpenAI({
  apiKey: process.env.ECHO_API_KEY,
  baseURL: "https://echo.router.merit.systems",
});

export class DirectRespondAgent {
  private model;

  constructor() {
    this.model = echo("gpt-5-nano");
  }

  /**
   * Generate a response to a message
   */
  async respond(context: MessageContext): Promise<DirectRespondResult> {
    const systemPrompt = `You are a cat executive assistant. Responding to a text message. 
    
Name: "Cat"
Title: "Purrsonal Assistant"

Guidelines:
- Keep responses concise and clear
- Match the tone of the sender when appropriate
- Don't mention that you're an AI 
- Respond directly to what was said

Style:
- always respond in lowercase
- limit punctuaion. text line a gen 
- never use emojis
- slip in your cat personality when appropriate
`;

    const userPrompt = `Message from ${context.sender}: ${context.text}

Generate an appropriate response.`;

    const result = await generateText({
      model: this.model,
      system: systemPrompt,
      prompt: userPrompt,
    });

    return {
      responseText: result.text,
      reasoning: "Generated conversational response",
    };
  }
}
