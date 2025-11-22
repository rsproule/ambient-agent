/**
 * AI Agent Types
 * 
 * Defines the types for the orchestrator and sub-agents
 */

export type AgentAction = "direct_respond" | "skip";

export interface AgentDecision {
  action: AgentAction;
  reasoning: string;
  confidence: number;
}

export interface MessageContext {
  text: string;
  sender: string;
  recipient?: string;
  groupId?: string;
  conversationHistory?: Array<{
    role: "user" | "assistant";
    content: string;
  }>;
}

export interface DirectRespondResult {
  responseText: string;
  reasoning?: string;
}


