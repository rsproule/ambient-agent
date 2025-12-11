/**
 * API endpoint for managing user workspace
 * GET /api/workspace - Get current workspace info
 * POST /api/workspace - Claim a workspace username
 */

import {
  claimWorkspaceUsername,
  getWorkspaceUsername,
  unclaimWorkspaceUsername,
} from "@/src/db/user";
import { auth } from "@/src/lib/auth/config";
import {
  createWorkspaceRepo,
  getWorkspaceRepoUrl,
} from "@/src/lib/integrations/workspace";
import { NextRequest, NextResponse } from "next/server";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const workspaceUsername = await getWorkspaceUsername(session.user.id);

    return NextResponse.json({
      workspaceUsername,
      repoUrl: workspaceUsername
        ? getWorkspaceRepoUrl(workspaceUsername)
        : null,
    });
  } catch (error) {
    console.error("Error fetching workspace:", error);
    return NextResponse.json(
      { error: "Failed to fetch workspace" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { username } = body;

    if (!username || typeof username !== "string") {
      return NextResponse.json(
        { error: "Username is required" },
        { status: 400 },
      );
    }

    // Normalize username to lowercase
    const normalizedUsername = username.toLowerCase();

    // Check if user already has a workspace
    const existingUsername = await getWorkspaceUsername(session.user.id);
    if (existingUsername) {
      return NextResponse.json(
        { error: "You already have a workspace claimed" },
        { status: 400 },
      );
    }

    // Claim username in DB first (atomic, uses unique constraint)
    // This prevents race conditions where two users try to claim the same username
    let user;
    try {
      user = await claimWorkspaceUsername(session.user.id, normalizedUsername);
    } catch (error) {
      // Username already taken (unique constraint violation)
      return NextResponse.json(
        {
          error:
            error instanceof Error
              ? error.message
              : `Username "${normalizedUsername}" is already taken`,
        },
        { status: 400 },
      );
    }

    // Create GitHub repo with default structure
    const repoResult = await createWorkspaceRepo(normalizedUsername);
    if (!repoResult.success) {
      // Rollback: unclaim the username since GitHub repo creation failed
      await unclaimWorkspaceUsername(session.user.id);
      return NextResponse.json(
        { error: repoResult.error || "Failed to create workspace repository" },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      workspaceUsername: user.workspaceUsername,
      repoUrl: getWorkspaceRepoUrl(normalizedUsername),
    });
  } catch (error) {
    console.error("Error claiming workspace:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to claim workspace",
      },
      { status: 500 },
    );
  }
}
