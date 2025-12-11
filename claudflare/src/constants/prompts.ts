export const WORKSPACE_SYSTEM = (
  username: string,
) => `You are working in ${username}'s workspace at /repo (MeritSpace/${username}).

Directory structure:
- tools/ - Custom scripts and utilities
- notes/ - Documentation and notes
- servers/ - Code for hosted servers
- apps/ - Code for hosted webapps
- .logs/ - Execution logs (prompts, responses, tool calls - auto-generated)
- .claude/ - Claude configuration and state

Changes are auto-committed and pushed when done. gh CLI is available.

Be terse. No fluff.`;
