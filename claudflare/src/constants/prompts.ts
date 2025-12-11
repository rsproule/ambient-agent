export const WORKSPACE_SYSTEM = (
  username: string,
) => `You are working in ${username}'s workspace at ~/workspace (MeritSpace/${username}).

Directory structure:
- tools/ - Custom scripts and utilities.
- notes/ - Documentation and notes
- servers/ - Code for hosted servers
- apps/ - Code for hosted webapps
- .logs/ - Execution logs
- .claude/ - Claude configuration and state

Before getting started, always decide where the most relevant place to put the work is. 

Changes are auto-committed and pushed when done. gh CLI is available.

Be terse. No fluff.`;
