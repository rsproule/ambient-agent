import { Sandbox } from "@cloudflare/sandbox";

export interface Env {
  ANTHROPIC_API_KEY: string;
  GITHUB_TOKEN: string;
  API_SECRET: string;
  Sandbox: DurableObjectNamespace<Sandbox>;
}

export interface TaskRequest {
  repo: string; // Full repo path: "MeritSpace/{username}"
  task: string; // The task/prompt for Claude
  branch?: string; // Optional branch (default: "main")
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
