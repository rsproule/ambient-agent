import { enqueueMessage } from "@/src/db/messageQueue";
import { getUserById } from "@/src/db/user";
import type { CreateQueuedMessageInput } from "@/src/lib/message-queue/types";
import { NextResponse } from "next/server";

/**
 * Generic message receiving webhook
 *
 * Accepts messages with the following structure:
 * - target: discriminated union (user_id, global, or segment)
 * - source: identifier for the notifier
 * - bribePayload: optional payment metadata
 * - payload: generic message data (JSON)
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Validate required fields
    if (!body.target || !body.source || !body.payload) {
      return NextResponse.json(
        {
          error: "Missing required fields",
          required: ["target", "source", "payload"],
        },
        { status: 400 },
      );
    }

    // Validate target structure
    if (!body.target.type) {
      return NextResponse.json(
        {
          error: "Invalid target structure",
          details: "target must have a 'type' field",
        },
        { status: 400 },
      );
    }

    // Validate target type
    const validTargetTypes = ["user_id", "global", "segment"];
    if (!validTargetTypes.includes(body.target.type)) {
      return NextResponse.json(
        {
          error: "Invalid target type",
          details: `target.type must be one of: ${validTargetTypes.join(", ")}`,
        },
        { status: 400 },
      );
    }

    // Validate user_id target has userId
    if (body.target.type === "user_id") {
      if (!body.target.userId) {
        return NextResponse.json(
          {
            error: "Invalid user_id target",
            details: "user_id target must have a 'userId' field",
          },
          { status: 400 },
        );
      }

      // Validate user exists in database
      const user = await getUserById(body.target.userId);
      if (!user) {
        return NextResponse.json(
          {
            error: "User not found",
            details: `No user found with ID: ${body.target.userId}`,
          },
          { status: 404 },
        );
      }
    }

    // Validate segment target has segmentId
    if (body.target.type === "segment" && !body.target.segmentId) {
      return NextResponse.json(
        {
          error: "Invalid segment target",
          details: "segment target must have a 'segmentId' field",
        },
        { status: 400 },
      );
    }

    // Create the message input
    const messageInput: CreateQueuedMessageInput = {
      target: body.target,
      source: body.source,
      bribePayload: body.bribePayload,
      payload: body.payload,
    };

    // Enqueue the message
    const messageId = await enqueueMessage(messageInput);

    console.log("Message enqueued:", {
      messageId,
      source: body.source,
      targetType: body.target.type,
    });

    return NextResponse.json(
      {
        success: true,
        messageId,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("Error processing message webhook:", error);

    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
