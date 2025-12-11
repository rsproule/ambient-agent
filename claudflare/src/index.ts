import { handleExecuteTask } from "./handlers/execute-task";
import { Env } from "./types";

const worker = {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext,
  ): Promise<Response> {
    const url = new URL(request.url);

    // Health check endpoint
    if (request.method === "GET" && url.pathname === "/health") {
      return new Response("ok", { status: 200 });
    }

    // Main task execution endpoint
    if (request.method === "POST" && url.pathname === "/execute") {
      return handleExecuteTask(request, env, ctx);
    }

    return new Response("not found", { status: 404 });
  },
};

export default worker;
export { Sandbox } from "@cloudflare/sandbox";
