/**
 * API endpoint for GitHub integration
 * GET /api/integrations/github?action={user|repos|activity|repo|prs}
 * 
 * Note: userId is taken from authenticated session, not query parameters
 * This prevents unauthorized access to other users' GitHub data
 */

import {
  getGitHubActivitySummary,
  getGitHubRepo,
  getGitHubUser,
  listGitHubPullRequests,
  listGitHubRepos,
} from "@/src/lib/integrations/github";
import { auth } from "@/src/lib/auth/config";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    // Verify user is authenticated
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Get userId from authenticated session (not from query parameters)
    const userId = session.user.id;

    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action") || "user";

    switch (action) {
      case "user": {
        const user = await getGitHubUser(userId);
        return NextResponse.json({ user });
      }

      case "repos": {
        const perPage = parseInt(searchParams.get("perPage") || "30");
        const page = parseInt(searchParams.get("page") || "1");
        const sort = (searchParams.get("sort") || "updated") as
          | "created"
          | "updated"
          | "pushed"
          | "full_name";

        const repos = await listGitHubRepos(userId, { perPage, page, sort });
        return NextResponse.json({ repos });
      }

      case "activity": {
        const summary = await getGitHubActivitySummary(userId);
        return NextResponse.json({ summary });
      }

      case "repo": {
        const owner = searchParams.get("owner");
        const repo = searchParams.get("repo");
        if (!owner || !repo) {
          return NextResponse.json(
            { error: "owner and repo are required" },
            { status: 400 },
          );
        }
        const repository = await getGitHubRepo(userId, owner, repo);
        return NextResponse.json({ repo: repository });
      }

      case "prs": {
        const owner = searchParams.get("owner");
        const repo = searchParams.get("repo");
        if (!owner || !repo) {
          return NextResponse.json(
            { error: "owner and repo are required" },
            { status: 400 },
          );
        }
        const state = (searchParams.get("state") || "open") as
          | "open"
          | "closed"
          | "all";
        const prs = await listGitHubPullRequests(userId, owner, repo, {
          state,
        });
        return NextResponse.json({ pullRequests: prs });
      }

      default:
        return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }
  } catch (error) {
    console.error("Error in GitHub integration:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to fetch GitHub data",
      },
      { status: 500 },
    );
  }
}
