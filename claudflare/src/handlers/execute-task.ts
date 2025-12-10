import { getSandbox } from "@cloudflare/sandbox";
import { WORKSPACE_SYSTEM } from "../constants/prompts";
import { Env, TaskRequest } from "../types";
import { escapeShell } from "../utils/strings";

/**
 * Wraps a ReadableStream to auto-commit changes and cleanup worktree when execution completes
 */
function wrapWithAutoCommitAndCleanup(
  stream: ReadableStream<Uint8Array>,
  sandbox: Awaited<ReturnType<typeof getSandbox>>,
  worktreePath: string,
  branch: string,
  taskSummary: string,
): ReadableStream<Uint8Array> {
  const reader = stream.getReader();

  return new ReadableStream({
    async pull(controller) {
      try {
        const { done, value } = await reader.read();

        if (done) {
          // Execution complete - commit and push changes, then cleanup worktree
          try {
            const commitMessage = `Claude: ${taskSummary.substring(0, 50)}${
              taskSummary.length > 50 ? "..." : ""
            }`;
            await sandbox.exec(`
              cd ${worktreePath} &&
              git add -A &&
              git diff --cached --quiet || git commit -m "${escapeShell(
                commitMessage,
              )}" &&
              git push origin ${branch}
            `);
          } catch (commitError) {
            console.error("Auto-commit failed:", commitError);
            // Don't fail the stream, just log the error
          }

          // Cleanup: remove the worktree
          try {
            await sandbox.exec(`
              cd /repo &&
              git worktree remove ${worktreePath} --force 2>/dev/null || rm -rf ${worktreePath}
            `);
          } catch (cleanupError) {
            console.error("Worktree cleanup failed:", cleanupError);
          }

          controller.close();
          return;
        }

        controller.enqueue(value);
      } catch (error) {
        controller.error(error);
      }
    },
    cancel() {
      reader.cancel();
      // Attempt cleanup on cancel too
      sandbox
        .exec(
          `
        cd /repo &&
        git worktree remove ${worktreePath} --force 2>/dev/null || rm -rf ${worktreePath}
      `,
        )
        .catch(() => {});
    },
  });
}

export async function handleExecuteTask(
  request: Request,
  env: Env,
): Promise<Response> {
  // Verify API secret
  const authHeader = request.headers.get("Authorization");
  if (!authHeader || authHeader !== `Bearer ${env.API_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const body = (await request.json()) as TaskRequest;
    const { repo, task, branch = "main" } = body;

    if (!task) {
      return new Response("task is required in request body", { status: 400 });
    }

    if (!repo) {
      return new Response("repo is required in request body", { status: 400 });
    }

    // Validate repo format: should be "MeritSpace/{username}"
    if (!repo.startsWith("MeritSpace/") || repo.split("/").length !== 2) {
      return new Response(
        'Invalid repo format. Expected "MeritSpace/{username}"',
        { status: 400 },
      );
    }

    const username = repo.split("/")[1];

    // Sanitize username to prevent command injection
    if (!/^[a-zA-Z0-9._-]+$/.test(username)) {
      return new Response("Invalid username in repo path", { status: 400 });
    }

    // Sanitize branch name to prevent command injection
    // Git branch names can contain: alphanumeric, -, _, /, .
    // But cannot contain: space, ~, ^, :, ?, *, [, \, or start with -
    if (!/^[a-zA-Z0-9][a-zA-Z0-9._/-]*$/.test(branch) || branch.length > 255) {
      return new Response("Invalid branch name", { status: 400 });
    }

    // Open sandbox with user-specific ID (reuses container per user)
    const sandbox = getSandbox(env.Sandbox, username);

    const { ANTHROPIC_API_KEY, GITHUB_TOKEN } = env;

    if (!ANTHROPIC_API_KEY) {
      return new Response("ANTHROPIC_API_KEY environment variable is not set", {
        status: 500,
      });
    }

    if (!GITHUB_TOKEN) {
      return new Response("GITHUB_TOKEN environment variable is not set", {
        status: 500,
      });
    }

    // Generate unique request ID for this execution (for worktree isolation)
    const requestId = crypto.randomUUID().slice(0, 8);
    const worktreePath = `/worktrees/${requestId}`;

    // Set env vars for the session
    await sandbox.setEnvVars({ ANTHROPIC_API_KEY, GITHUB_TOKEN });

    // Configure gh CLI authentication
    await sandbox.exec(
      `runuser -u claudeuser -- env HOME=/home/claudeuser GITHUB_TOKEN="${GITHUB_TOKEN}" gh auth login --with-token <<< "${GITHUB_TOKEN}"`,
    );

    // Clone or update the main repo (shared across requests for this user)
    // Use a bare-ish approach: clone once, fetch on subsequent requests
    try {
      await sandbox.exec(`
        if [ ! -d /repo/.git ]; then
          git clone https://x-access-token:${GITHUB_TOKEN}@github.com/${repo}.git /repo
        else
          cd /repo && git fetch origin
        fi
      `);
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error("Sandbox git clone/fetch error:", errorMessage);
      return new Response(`Failed to clone workspace: ${errorMessage}`, {
        status: 500,
      });
    }

    // Create a worktree for this specific request (allows concurrent execution)
    try {
      await sandbox.exec(`
        mkdir -p /worktrees &&
        cd /repo &&
        git worktree add ${worktreePath} origin/${branch} -B ${branch}
      `);
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error("Failed to create worktree:", errorMessage);
      return new Response(`Failed to create worktree: ${errorMessage}`, {
        status: 500,
      });
    }

    // Set permissions for claudeuser
    await sandbox.exec(`chown -R claudeuser:claudeuser ${worktreePath}`);

    // Configure git for commits in the worktree
    await sandbox.exec(`
      cd ${worktreePath} &&
      git config user.email "merit-bot@meritspace.dev" &&
      git config user.name "Merit Bot"
    `);

    // Escape prompts for safe shell execution
    const systemPrompt = escapeShell(WORKSPACE_SYSTEM(username));
    const taskPrompt = escapeShell(task);

    // Construct command (run in the worktree)
    const cmd = `cd ${worktreePath} && runuser -u claudeuser -- env HOME=/home/claudeuser claude --append-system-prompt "${systemPrompt}" --model "claude-sonnet-4-20250514" -p "${taskPrompt}" --dangerously-skip-permissions --output-format stream-json --verbose`;

    const stream = await sandbox.execStream(cmd);

    // Wrap stream with auto-commit and worktree cleanup on completion
    const wrappedStream = wrapWithAutoCommitAndCleanup(
      stream,
      sandbox,
      worktreePath,
      branch,
      task,
    );

    return new Response(wrappedStream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
      },
    });
  } catch (error) {
    console.error("Error handling execute task:", error);
    return new Response("invalid body", { status: 400 });
  }
}
