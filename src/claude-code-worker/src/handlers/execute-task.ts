import { getSandbox } from "@cloudflare/sandbox";
import { WORKSPACE_SYSTEM } from "../constants/prompts";
import { Env, TaskRequest } from "../types";
import { escapeShell } from "../utils/strings";

/**
 * Wraps a ReadableStream to auto-commit changes when execution completes
 */
function wrapWithAutoCommit(
  stream: ReadableStream<Uint8Array>,
  sandbox: Awaited<ReturnType<typeof getSandbox>>,
  branch: string,
  taskSummary: string,
): ReadableStream<Uint8Array> {
  const reader = stream.getReader();

  return new ReadableStream({
    async pull(controller) {
      try {
        const { done, value } = await reader.read();

        if (done) {
          // Execution complete - commit and push changes
          try {
            const commitMessage = `Claude: ${taskSummary.substring(0, 50)}${
              taskSummary.length > 50 ? "..." : ""
            }`;
            await sandbox.exec(`
              cd workspace &&
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
    },
  });
}

export async function handleExecuteTask(
  request: Request,
  env: Env,
): Promise<Response> {
  try {
    const body = await request.json<TaskRequest>();
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

    // Open sandbox with unique ID
    const sandbox = getSandbox(env.Sandbox, crypto.randomUUID().slice(0, 8));

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

    // Set env vars for the session
    await sandbox.setEnvVars({ ANTHROPIC_API_KEY, GITHUB_TOKEN });

    // Configure gh CLI authentication
    await sandbox.exec(
      `runuser -u claudeuser -- env HOME=/home/claudeuser GITHUB_TOKEN="${GITHUB_TOKEN}" gh auth login --with-token <<< "${GITHUB_TOKEN}"`,
    );

    // Clone user's persistent workspace
    try {
      await sandbox.gitCheckout(repo, { targetDir: "workspace", branch });
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error("Sandbox git checkout error:", errorMessage);
      return new Response(`Failed to clone workspace: ${errorMessage}`, {
        status: 500,
      });
    }

    // Set permissions for claudeuser
    await sandbox.exec(`chown -R claudeuser:claudeuser workspace`);

    // Configure git for commits
    await sandbox.exec(`
      cd workspace &&
      git config user.email "merit-bot@meritspace.dev" &&
      git config user.name "Merit Bot"
    `);

    // Escape prompts for safe shell execution
    const systemPrompt = escapeShell(WORKSPACE_SYSTEM(username));
    const taskPrompt = escapeShell(task);

    // Construct command
    const cmd = `cd workspace && runuser -u claudeuser -- env HOME=/home/claudeuser claude --append-system-prompt "${systemPrompt}" --model "claude-sonnet-4-20250514" -p "${taskPrompt}" --dangerously-skip-permissions --output-format stream-json --verbose`;

    const stream = await sandbox.execStream(cmd);

    // Wrap stream with auto-commit on completion
    const wrappedStream = wrapWithAutoCommit(stream, sandbox, branch, task);

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
