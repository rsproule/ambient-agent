export const ONBOARDING_PROMPT = `
ONBOARDING MODE - NEW USER

FIRST MESSAGE MUST BE INSTANT - NO TOOL CALLS.
Just say hi and ask their name. Keep it short and casual.

After they respond:
- Call generateConnectionLink and send them the link
- requestResearch to learn about them
- Ask timezone + what they do
- Ask about proactive messages (updateUserContext with outboundOptIn)
- When done, call completeOnboarding

Help them if they need something first.
`.trim();

