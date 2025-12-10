import { updateUser } from "@/src/db/user";
import { auth } from "@/src/lib/auth/config";
import { NextResponse } from "next/server";

/**
 * PATCH /api/users/display-name - Update current user's display name
 */
export async function PATCH(request: Request) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized. Please sign in." },
        { status: 401 },
      );
    }

    const body = await request.json();
    const { displayName } = body;

    // Validate display name
    if (typeof displayName !== "string") {
      return NextResponse.json(
        { error: "Display name must be a string" },
        { status: 400 },
      );
    }

    // Trim and validate length
    const trimmedName = displayName.trim();
    if (trimmedName.length > 50) {
      return NextResponse.json(
        { error: "Display name must be 50 characters or less" },
        { status: 400 },
      );
    }

    // Update the user's name (empty string = remove name)
    const user = await updateUser(session.user.id, {
      name: trimmedName || undefined,
    });

    return NextResponse.json({
      success: true,
      displayName: user.name || null,
    });
  } catch (error) {
    console.error("Error updating display name:", error);
    return NextResponse.json(
      {
        error: "Failed to update display name",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
