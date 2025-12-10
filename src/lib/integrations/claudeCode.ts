/**
 * Claude Code Integration Client
 *
 * Client library to invoke Claude Code execution in a Cloudflare Worker sandbox.
 * Each user has a persistent GitHub workspace at MeritSpace/{username}.
 */

const MERITSPACE_ORG = "MeritSpace";

export interface ClaudeCodeRequest {
  /** User's workspace username (the repo will be MeritSpace/{username}) */
  workspaceUsername: string;
  /** The task/prompt for Claude to execute */
  task: string;
  /** Optional branch (default: "main") */
  branch?: string;
}

export interface ClaudeCodeResult {
  success: boolean;
  output?: string;
  error?: string;
}

/**
 * Get the worker URL from environment
 */
function getWorkerUrl(): string {
  const url = process.env.CLAUDE_CODE_WORKER_URL;
  if (!url) {
    throw new Error("CLAUDE_CODE_WORKER_URL environment variable is not set");
  }
  return url;
}

/**
 * Build the full repo path from workspace username
 */
function buildRepoPath(workspaceUsername: string): string {
  return `${MERITSPACE_ORG}/${workspaceUsername}`;
}

/**
 * Stream Claude Code execution results
 * Returns an async iterable of string chunks
 */
export async function* streamClaudeCode(
  request: ClaudeCodeRequest,
): AsyncGenerator<string, void, unknown> {
  const workerUrl = getWorkerUrl();
  const repo = buildRepoPath(request.workspaceUsername);

  const response = await fetch(`${workerUrl}/execute`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      repo,
      task: request.task,
      branch: request.branch ?? "main",
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Claude Code execution failed: ${error}`);
  }

  if (!response.body) {
    throw new Error("No response body from Claude Code worker");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      yield chunk;
    }
  } finally {
    reader.releaseLock();
  }
}

/**
 * Execute Claude Code and return the full result
 * Collects all streamed output into a single result
 */
export async function executeClaudeCode(
  request: ClaudeCodeRequest,
): Promise<ClaudeCodeResult> {
  try {
    const chunks: string[] = [];

    for await (const chunk of streamClaudeCode(request)) {
      chunks.push(chunk);
    }

    const output = chunks.join("");

    return {
      success: true,
      output,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Check if the Claude Code worker is available
 */
export async function checkClaudeCodeHealth(): Promise<boolean> {
  try {
    const workerUrl = getWorkerUrl();
    const response = await fetch(`${workerUrl}/health`, {
      method: "GET",
    });
    return response.ok;
  } catch {
    return false;
  }
}
