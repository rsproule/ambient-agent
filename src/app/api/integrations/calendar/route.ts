/**
 * Example API endpoint for Google Calendar integration
 * GET /api/integrations/calendar?userId={userId}&action={list|today|week}
 */

import { NextRequest, NextResponse } from "next/server";
import {
  listCalendarEvents,
  getTodaysEvents,
  getWeeklyEvents,
  getCalendarEvent,
} from "@/src/lib/integrations/calendar";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");
    const action = searchParams.get("action") || "list";

    if (!userId) {
      return NextResponse.json(
        { error: "userId is required" },
        { status: 400 }
      );
    }

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

