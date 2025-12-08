/**
 * Agent personality configuration
 * 
 * A personality defines the character, voice, style, and behavior
 * of an agent. This is separate from the technical requirements
 * of interacting with iMessage.
 */
export interface AgentPersonality {
  /**
   * Unique identifier for the personality
   */
  id: string;

  /**
   * Display name
   */
  name: string;

  /**
   * Description of the personality (for documentation)
   */
  description?: string;

  /**
   * The personality prompt that defines:
   * - Voice & Style
   * - Core Identity
   * - Behavior Rules
   * - Any personality-specific quirks
   */
  prompt: string;
}





