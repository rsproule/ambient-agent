/**
 * API endpoint to reset workspace to initial state
 * POST /api/workspace/reset
 */

import { getWorkspaceUsername } from "@/src/db/user";
import { auth } from "@/src/lib/auth/config";
import { resetWorkspaceRepo } from "@/src/lib/integrations/workspace";
import { NextResponse } from "next/server";

export async function POST() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const workspaceUsername = await getWorkspaceUsername(session.user.id);
    if (!workspaceUsername) {
      return NextResponse.json(
        { error: "No workspace found" },
        { status: 404 },
      );
    }

    const result = await resetWorkspaceRepo(workspaceUsername);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Failed to reset workspace" },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      message: "Workspace reset to initial state",
    });
  } catch (error) {
    console.error("Error resetting workspace:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to reset workspace",
      },
      { status: 500 },
    );
  }
}
