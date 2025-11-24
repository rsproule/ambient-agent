import { createUser, listUsers } from "@/src/db/user";
import { NextResponse } from "next/server";

/**
 * GET /api/admin/users - List all users
 */
export async function GET() {
  try {
    const users = await listUsers(1000); // Get up to 1000 users

    return NextResponse.json({
      success: true,
      users,
    });
  } catch (error) {
    console.error("Error fetching users:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch users",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}

/**
 * POST /api/admin/users - Create a new user
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Validate at least one identifier is provided
    if (!body.phoneNumber && !body.email && !body.name) {
      return NextResponse.json(
        {
          error: "Missing required fields",
          details:
            "At least one of: phoneNumber, email, or name must be provided",
        },
        { status: 400 },
      );
    }

    // Validate phone number format if provided
    if (body.phoneNumber && !body.phoneNumber.match(/^\+?[1-9]\d{1,14}$/)) {
      return NextResponse.json(
        {
          error: "Invalid phone number format",
          details: "Phone number must include country code (e.g., +1234567890)",
        },
        { status: 400 },
      );
    }

    // Create the user
    const user = await createUser({
      phoneNumber: body.phoneNumber,
      name: body.name,
      email: body.email,
      metadata: body.metadata,
    });

    console.log("User created:", {
      id: user.id,
      phoneNumber: user.phoneNumber,
      email: user.email,
    });

    return NextResponse.json(
      {
        success: true,
        user,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Error creating user:", error);

    // Check for unique constraint violations
    if (error instanceof Error && error.message.includes("Unique constraint")) {
      return NextResponse.json(
        {
          error: "User already exists",
          details: "A user with this phone number already exists",
        },
        { status: 409 },
      );
    }

    return NextResponse.json(
      {
        error: "Failed to create user",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
