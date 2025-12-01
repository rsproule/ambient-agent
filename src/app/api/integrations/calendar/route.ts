/**
 * API endpoint for Google Calendar integration
 * GET /api/integrations/calendar?action={list|today|week|get}
 * 
 * Note: userId is taken from authenticated session, not query parameters
 * This prevents unauthorized access to other users' calendar data
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/src/lib/auth/config";
import {
  listCalendarEvents,
  getTodaysEvents,
  getWeeklyEvents,
  getCalendarEvent,
} from "@/src/lib/integrations/calendar";

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
    const action = searchParams.get("action") || "list";

    switch (action) {
      case "list": {
        const maxResults = parseInt(searchParams.get("maxResults") || "10");
        const calendarId = searchParams.get("calendarId") || "primary";
        const events = await listCalendarEvents(userId, {
          calendarId,
          maxResults,
        });
        return NextResponse.json({ events });
      }

      case "today": {
        const calendarId = searchParams.get("calendarId") || "primary";
        const events = await getTodaysEvents(userId, calendarId);
        return NextResponse.json({ events });
      }

      case "week": {
        const calendarId = searchParams.get("calendarId") || "primary";
        const events = await getWeeklyEvents(userId, calendarId);
        return NextResponse.json({ events });
      }

      case "get": {
        const eventId = searchParams.get("eventId");
        const calendarId = searchParams.get("calendarId") || "primary";
        if (!eventId) {
          return NextResponse.json(
            { error: "eventId is required" },
            { status: 400 }
          );
        }
        const event = await getCalendarEvent(userId, eventId, calendarId);
        return NextResponse.json({ event });
      }

      default:
        return NextResponse.json(
          { error: "Invalid action" },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error("Error in Calendar integration:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to fetch Calendar data",
      },
      { status: 500 }
    );
  }
}
