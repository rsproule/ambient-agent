import { Sandbox } from "@cloudflare/sandbox";

export interface Env {
  ANTHROPIC_API_KEY: string;
  GITHUB_TOKEN: string;
  API_SECRET: string;
  DEFAULT_BRANCH?: string; // Default branch for repos (defaults to "master")
  Sandbox: DurableObjectNamespace<Sandbox>;
}

export interface TaskRequest {
  repo: string; // Full repo path: "MeritSpace/{username}"
  task: string; // The task/prompt for Claude
  branch?: string; // Optional branch (default: env.DEFAULT_BRANCH or "master")
}

export interface ExecutionResult {
  type?: string;
  name?: string;
  cmd: string;
  success: boolean;
  stdout?: string;
  stderr?: string;
  error?: string;
  original?: string;
  escaped?: string;
}
