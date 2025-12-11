import { getSandbox } from "@cloudflare/sandbox";
import { WORKSPACE_SYSTEM } from "../constants/prompts";
import { Env } from "../types";
import { runCmd, SandboxType } from "../utils/sandbox";
import { escapeShell } from "../utils/strings";

const USERNAME = "rsproule";
const REPO = `MeritSpace/${USERNAME}`;
const WORKSPACE = "/home/claudeuser/workspace";

/**
 * Consumes the stream fully and performs logging + commit at the end.
 * This runs via waitUntil() so it completes regardless of HTTP connection.
 */
async function consumeAndCommit(
  stream: ReadableStream<Uint8Array>,
  sandbox: SandboxType,
  branch: string,
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

    console.log("[consumeAndCommit] Stream complete, writing log...");
    const run = (cmd: string) => `runuser -u claudeuser -- ${cmd}`;

    // Write log file (redact secrets)
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const logDir = `${WORKSPACE}/.logs`;
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

    // Commit and push
    const msg = `Claude: ${task.substring(0, 50)}${
      task.length > 50 ? "..." : ""
    }`;
    await runCmd(sandbox, run(`git -C ${WORKSPACE} add -A`), "git-add");

    const diff = await runCmd(
      sandbox,
      run(`git -C ${WORKSPACE} diff --cached --quiet; echo $?`),
      "git-diff",
    );
    if (diff.stdout.trim() !== "0") {
      await runCmd(
        sandbox,
        run(`git -C ${WORKSPACE} commit -m "${escapeShell(msg)}"`),
        "git-commit",
      );
      await runCmd(
        sandbox,
        run(`git -C ${WORKSPACE} push origin ${branch}`),
        "git-push",
      );
    }

    console.log("[consumeAndCommit] Done");
  } catch (error) {
    console.error("[consumeAndCommit] Error:", error);
  }
}

async function ensureUser(sandbox: SandboxType) {
  const check = await runCmd(sandbox, "id claudeuser", "user-check");
  if (!check.success) {
    await runCmd(sandbox, "useradd -m -s /bin/bash claudeuser", "create-user");
  }
}

async function setupRepo(sandbox: SandboxType, token: string, branch: string) {
  // Run git operations as claudeuser so ownership is correct from the start
  const run = (cmd: string) => `runuser -u claudeuser -- ${cmd}`;

  const check = await runCmd(
    sandbox,
    `test -d ${WORKSPACE}/.git && echo exists || echo missing`,
    "repo-check",
  );

  if (check.stdout.trim() === "missing") {
    const clone = await runCmd(
      sandbox,
      run(
        `git clone https://x-access-token:${token}@github.com/${REPO}.git ${WORKSPACE}`,
      ),
      "clone",
    );
    if (!clone.success) throw new Error(`Clone failed: ${clone.stderr}`);
  } else {
    await runCmd(
      sandbox,
      run(`git -C ${WORKSPACE} reset --hard HEAD`),
      "reset",
    );
    const pull = await runCmd(
      sandbox,
      run(`git -C ${WORKSPACE} pull origin ${branch}`),
      "pull",
    );
    if (!pull.success) throw new Error(`Pull failed: ${pull.stderr}`);
  }

  await runCmd(
    sandbox,
    run(`git -C ${WORKSPACE} config user.email "merit-bot@merit.systems"`),
    "config-email",
  );
  await runCmd(
    sandbox,
    run(`git -C ${WORKSPACE} config user.name "Merit Bot"`),
    "config-name",
  );
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

  const { ANTHROPIC_API_KEY, GITHUB_TOKEN } = env;
  if (!ANTHROPIC_API_KEY)
    return new Response("ANTHROPIC_API_KEY not set", { status: 500 });
  if (!GITHUB_TOKEN)
    return new Response("GITHUB_TOKEN not set", { status: 500 });

  try {
    const body = (await request.json()) as { task?: string; branch?: string };
    const { task, branch = "main" } = body;
    if (!task) return new Response("task required", { status: 400 });

    const sessionId = crypto.randomUUID().slice(0, 8);
    const sandbox = getSandbox(env.Sandbox, sessionId);

    await sandbox.setEnvVars({ ANTHROPIC_API_KEY, GITHUB_TOKEN });
    await ensureUser(sandbox);
    await setupRepo(sandbox, GITHUB_TOKEN, branch);

    const systemPrompt = escapeShell(WORKSPACE_SYSTEM(USERNAME));
    const taskPrompt = escapeShell(task);
    const claudeCommand = [
      `cd ${WORKSPACE}`,
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

    // Background: consume full stream and commit (runs regardless of HTTP connection)
    ctx.waitUntil(consumeAndCommit(backgroundStream, sandbox, branch, task));

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
