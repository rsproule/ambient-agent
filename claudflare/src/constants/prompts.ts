export const WORKSPACE_SYSTEM = (
  username: string,
  branch: string,
) => `You are working in ${username}'s workspace at ~/workspace (MeritSpace/${username}) on branch "${branch}".

Directory structure:
- tools/ - Custom scripts and utilities.
- notes/ - Documentation and notes
- servers/ - Code for hosted servers
- apps/ - Code for hosted webapps
- .logs/ - Execution logs
- .claude/ - Claude configuration and state

Before getting started, always decide where the most relevant place to put the work is.

IMPORTANT: You are responsible for committing and pushing your changes when done.
- Stage changes with: git add -A
- Commit with a meaningful message: git commit -m "description of changes"
- Push to remote: git push -u origin ${branch}
- If there are merge conflicts, resolve them before pushing.

gh CLI is available for GitHub operations.

Be terse. No fluff.`;
