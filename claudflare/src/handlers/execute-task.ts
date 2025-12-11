import { getSandbox } from "@cloudflare/sandbox";
import { WORKSPACE_SYSTEM } from "../constants/prompts";
import { Env } from "../types";
import { runCmd, SandboxType } from "../utils/sandbox";
import { escapeShell } from "../utils/strings";

const REPO_BASE = "/home/claudeuser/repo";
const WORKTREES_BASE = "/home/claudeuser/worktrees";

/**
 * Consumes the stream fully and cleans up worktree when done.
 * This runs via waitUntil() so it completes regardless of HTTP connection.
 * Note: Claude is responsible for committing and pushing changes.
 */
async function consumeAndCleanup(
  stream: ReadableStream<Uint8Array>,
  sandbox: SandboxType,
  worktreePath: string,
  task: string,
): Promise<void> {
  const reader = stream.getReader();
  const chunks: string[] = [];
  const decoder = new TextDecoder();

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(decoder.decode(value, { stream: true }));
    }

    console.log("[consumeAndCleanup] Stream complete, writing log...");
    const run = (cmd: string) => `runuser -u claudeuser -- ${cmd}`;

    // Write log file (redact secrets)
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const logDir = `${worktreePath}/.logs`;
    const logPath = `${logDir}/${timestamp}.json`;
    const redacted = chunks
      .join("")
      .replace(/sk-ant-[a-zA-Z0-9_-]+/g, "[REDACTED]");
    const logContent = JSON.stringify({ task, output: redacted });
    const b64 = btoa(unescape(encodeURIComponent(logContent)));

    await runCmd(sandbox, run(`mkdir -p ${logDir}`), "mkdir-logs");
    await runCmd(
      sandbox,
      run(`bash -c 'echo "${b64}" | base64 -d > ${logPath}'`),
      "write-log",
    );

    // Cleanup: remove worktree after task completes
    console.log("[consumeAndCleanup] Removing worktree...");
    await runCmd(
      sandbox,
      run(`git -C ${REPO_BASE} worktree remove --force ${worktreePath}`),
      "worktree-remove",
    );

    console.log("[consumeAndCleanup] Done");
  } catch (error) {
    console.error("[consumeAndCleanup] Error:", error);
  }
}

async function ensureUser(sandbox: SandboxType) {
  const check = await runCmd(sandbox, "id claudeuser", "user-check");
  if (!check.success) {
    await runCmd(sandbox, "useradd -m -s /bin/bash claudeuser", "create-user");
  }
}

/**
 * Ensures the main repo is cloned and up to date.
 * This is the "bare" repo that worktrees are created from.
 */
async function setupMainRepo(
  sandbox: SandboxType,
  token: string,
  repo: string,
) {
  const run = (cmd: string) => `runuser -u claudeuser -- ${cmd}`;

  const check = await runCmd(
    sandbox,
    `test -d ${REPO_BASE}/.git && echo exists || echo missing`,
    "repo-check",
  );

  if (check.stdout.trim() === "missing") {
    // Clone for the first time
    const clone = await runCmd(
      sandbox,
      run(
        `git clone https://x-access-token:${token}@github.com/${repo}.git ${REPO_BASE}`,
      ),
      "clone",
    );
    if (!clone.success) throw new Error(`Clone failed: ${clone.stderr}`);
  } else {
    // Fetch latest from remote
    await runCmd(sandbox, run(`git -C ${REPO_BASE} fetch --all`), "fetch");
  }

  // Configure git user
  await runCmd(
    sandbox,
    run(`git -C ${REPO_BASE} config user.email "merit-bot@merit.systems"`),
    "config-email",
  );
  await runCmd(
    sandbox,
    run(`git -C ${REPO_BASE} config user.name "Merit Bot"`),
    "config-name",
  );

  // Ensure worktrees directory exists
  await runCmd(sandbox, run(`mkdir -p ${WORKTREES_BASE}`), "mkdir-worktrees");
}

/**
 * Creates a worktree for this request on the specified branch.
 * Returns the path to the worktree.
 */
async function createWorktree(
  sandbox: SandboxType,
  branch: string,
  requestId: string,
): Promise<string> {
  const run = (cmd: string) => `runuser -u claudeuser -- ${cmd}`;
  const worktreePath = `${WORKTREES_BASE}/${requestId}`;

  // Check if branch exists on remote
  const remoteRef = await runCmd(
    sandbox,
    run(`git -C ${REPO_BASE} ls-remote --heads origin ${branch}`),
    "check-remote-branch",
  );

  if (remoteRef.stdout.includes(branch)) {
    // Branch exists on remote, create worktree tracking it
    await runCmd(
      sandbox,
      run(`git -C ${REPO_BASE} worktree add ${worktreePath} origin/${branch}`),
      "worktree-add-existing",
    );
  } else {
    // Branch doesn't exist, create new branch in worktree
    await runCmd(
      sandbox,
      run(`git -C ${REPO_BASE} worktree add -b ${branch} ${worktreePath}`),
      "worktree-add-new",
    );
  }

  return worktreePath;
}

export async function handleExecuteTask(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
): Promise<Response> {
  const authHeader = request.headers.get("Authorization");
  if (authHeader !== `Bearer ${env.API_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { ANTHROPIC_API_KEY, GITHUB_TOKEN, DEFAULT_BRANCH = "master" } = env;
  if (!ANTHROPIC_API_KEY)
    return new Response("ANTHROPIC_API_KEY not set", { status: 500 });
  if (!GITHUB_TOKEN)
    return new Response("GITHUB_TOKEN not set", { status: 500 });

  try {
    const body = (await request.json()) as {
      task?: string;
      repo?: string;
      branch?: string;
    };
    const { task, repo, branch = DEFAULT_BRANCH } = body;
    if (!task) return new Response("task required", { status: 400 });
    if (!repo)
      return new Response("repo required (format: owner/name)", {
        status: 400,
      });

    // Extract username from repo (e.g., "MeritSpace/rsproule" -> "rsproule")
    const username = repo.split("/")[1];
    if (!username)
      return new Response("invalid repo format (expected: owner/name)", {
        status: 400,
      });

    // Use username as sessionId to reuse sandbox per user (warm starts)
    const sandbox = getSandbox(env.Sandbox, username);
    const requestId = crypto.randomUUID().slice(0, 8);

    await sandbox.setEnvVars({ ANTHROPIC_API_KEY, GITHUB_TOKEN });
    await ensureUser(sandbox);
    await setupMainRepo(sandbox, GITHUB_TOKEN, repo);
    const worktreePath = await createWorktree(sandbox, branch, requestId);

    // Create ~/workspace symlink pointing to this worktree for convenience
    const run = (cmd: string) => `runuser -u claudeuser -- ${cmd}`;
    await runCmd(
      sandbox,
      run(`ln -sfn ${worktreePath} /home/claudeuser/workspace`),
      "symlink-workspace",
    );

    const systemPrompt = escapeShell(WORKSPACE_SYSTEM(username, branch));
    const taskPrompt = escapeShell(task);
    const claudeCommand = [
      `cd ${worktreePath}`,
      "&&",
      "runuser -u claudeuser -- env HOME=/home/claudeuser",
      `ANTHROPIC_API_KEY="${ANTHROPIC_API_KEY}"`,
      "claude",
      `--append-system-prompt "${systemPrompt}"`,
      "--model opus",
      `-p "${taskPrompt}"`,
      "--dangerously-skip-permissions",
      "--output-format stream-json",
      "--verbose",
    ].join(" ");

    const stream = await sandbox.execStream(claudeCommand);

    // Tee the stream: one branch for background processing, one for HTTP response
    const [backgroundStream, responseStream] = stream.tee();

    // Background: consume stream and cleanup worktree when done
    ctx.waitUntil(
      consumeAndCleanup(backgroundStream, sandbox, worktreePath, task),
    );

    // HTTP response: optional observer, can disconnect without affecting the task
    return new Response(responseStream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
      },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return new Response(`Error: ${msg}`, { status: 500 });
  }
}
