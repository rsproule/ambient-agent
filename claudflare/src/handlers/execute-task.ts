import { getSandbox } from "@cloudflare/sandbox";
import { WORKSPACE_SYSTEM } from "../constants/prompts";
import { Env } from "../types";
import { runCmd, SandboxType } from "../utils/sandbox";
import { escapeShell } from "../utils/strings";

const USERNAME = "rsproule";
const REPO = `MeritSpace/${USERNAME}`;
const WORKSPACE = "/home/claudeuser/workspace";

function wrapWithCommit(
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
        console.log("Stream complete, committing...");
        const run = (cmd: string) => `runuser -u claudeuser -- ${cmd}`;

        const msg = `Claude: ${task.substring(0, 50)}${
          task.length > 50 ? "..." : ""
        }`;
        const add = await runCmd(
          sandbox,
          run(`git -C ${WORKSPACE} add -A`),
          "git-add",
        );
        console.log("git add:", add.success);

        const diff = await runCmd(
          sandbox,
          run(`git -C ${WORKSPACE} diff --cached --quiet; echo $?`),
          "git-diff",
        );
        console.log("git diff:", diff.stdout.trim());

        if (diff.stdout.trim() !== "0") {
          const commit = await runCmd(
            sandbox,
            run(`git -C ${WORKSPACE} commit -m "${escapeShell(msg)}"`),
            "git-commit",
          );
          console.log("git commit:", commit.success, commit.stderr);

          const push = await runCmd(
            sandbox,
            run(`git -C ${WORKSPACE} push origin ${branch}`),
            "git-push",
          );
          console.log("git push:", push.success, push.stderr);
        } else {
          console.log("No changes to commit");
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
    const cmd = `cd ${WORKSPACE} && runuser -u claudeuser -- env HOME=/home/claudeuser ANTHROPIC_API_KEY="${ANTHROPIC_API_KEY}" claude --append-system-prompt "${systemPrompt}" --model "claude-sonnet-4-20250514" -p "${taskPrompt}" --dangerously-skip-permissions --output-format stream-json --verbose`;

    const stream = await sandbox.execStream(cmd);

    return new Response(wrapWithCommit(stream, sandbox, branch, task), {
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
