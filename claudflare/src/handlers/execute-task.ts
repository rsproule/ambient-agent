import { getSandbox } from "@cloudflare/sandbox";
import { WORKSPACE_SYSTEM } from "../constants/prompts";
import { Env } from "../types";
import { runCmd, SandboxType } from "../utils/sandbox";
import { escapeShell } from "../utils/strings";

const USERNAME = "rsproule";
const REPO = `MeritSpace/${USERNAME}`;

function wrapWithAutoCommit(
  stream: ReadableStream<Uint8Array>,
  sandbox: SandboxType,
  branch: string,
  task: string,
): ReadableStream<Uint8Array> {
  const reader = stream.getReader();

  return new ReadableStream({
    async pull(controller) {
      const { done, value } = await reader.read();

      if (done) {
        const msg = `Claude: ${task.substring(0, 50)}${
          task.length > 50 ? "..." : ""
        }`;
        await runCmd(sandbox, "cd /repo && git add -A", "git-add");
        const diff = await runCmd(
          sandbox,
          "cd /repo && git diff --cached --quiet; echo $?",
          "git-diff",
        );

        if (diff.stdout.trim() !== "0") {
          await runCmd(
            sandbox,
            `cd /repo && git commit -m "${escapeShell(msg)}"`,
            "git-commit",
          );
          await runCmd(
            sandbox,
            `cd /repo && git push origin ${branch}`,
            "git-push",
          );
        }

        controller.close();
        return;
      }

      controller.enqueue(value);
    },
    cancel() {
      reader.cancel();
    },
  });
}

async function setupRepo(sandbox: SandboxType, token: string, branch: string) {
  const check = await runCmd(
    sandbox,
    "test -d /repo/.git && echo exists || echo missing",
    "repo-check",
  );

  if (check.stdout.trim() === "missing") {
    const clone = await runCmd(
      sandbox,
      `git clone https://x-access-token:${token}@github.com/${REPO}.git /repo`,
      "clone",
    );
    if (!clone.success) throw new Error(`Clone failed: ${clone.stderr}`);
  } else {
    await runCmd(sandbox, "cd /repo && git reset --hard HEAD", "reset");
    const pull = await runCmd(
      sandbox,
      `cd /repo && git pull origin ${branch}`,
      "pull",
    );
    if (!pull.success) throw new Error(`Pull failed: ${pull.stderr}`);
  }

  await runCmd(
    sandbox,
    `cd /repo && git config user.email "merit-bot@meritspace.dev"`,
    "config",
  );
  await runCmd(
    sandbox,
    `cd /repo && git config user.name "Merit Bot"`,
    "config",
  );
}

async function ensureUser(sandbox: SandboxType) {
  const check = await runCmd(sandbox, "id claudeuser", "user-check");
  if (!check.success) {
    await runCmd(sandbox, "useradd -m -s /bin/bash claudeuser", "create-user");
  }
  await runCmd(sandbox, "chown -R claudeuser:claudeuser /repo", "chown");
}

export async function handleExecuteTask(
  request: Request,
  env: Env,
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
    await setupRepo(sandbox, GITHUB_TOKEN, branch);
    await ensureUser(sandbox);

    const systemPrompt = escapeShell(WORKSPACE_SYSTEM(USERNAME));
    const taskPrompt = escapeShell(task);
    const cmd = `cd /repo && runuser -u claudeuser -- env HOME=/home/claudeuser ANTHROPIC_API_KEY="${ANTHROPIC_API_KEY}" claude --append-system-prompt "${systemPrompt}" --model "claude-sonnet-4-20250514" -p "${taskPrompt}" --dangerously-skip-permissions --output-format stream-json --verbose`;

    const stream = await sandbox.execStream(cmd);

    return new Response(wrapWithAutoCommit(stream, sandbox, branch, task), {
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
