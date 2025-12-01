/**
 * Calendar Hook
 *
 * Checks for upcoming calendar events and sends reminders
 */

import { listCalendarEvents } from "@/src/lib/integrations/calendar";
import type { HookContext, HookResult } from "../types";

/**
 * Check for calendar events starting soon
 */
export async function checkCalendar(
  context: HookContext,
  reminderMinutes: number = 30,
): Promise<HookResult> {
  // Skip if calendar not connected
  if (!context.connections.calendar) {
    return { shouldNotify: false };
  }

  try {
    const now = new Date();
    const reminderWindow = new Date(now.getTime() + reminderMinutes * 60 * 1000);

    // Get events in the next reminderMinutes
    const events = await listCalendarEvents(context.userId, {
      timeMin: now,
      timeMax: reminderWindow,
      maxResults: 5,
    });

    if (!events.items || events.items.length === 0) {
      return { shouldNotify: false };
    }

    // Filter to events that haven't been notified about
    const newEvents = events.items.filter((event) => {
      const eventId = event.id;
      const signature = `calendar:reminder:${eventId}`;

      // Check if we've already notified about this event
      const alreadyNotified = context.recentMessages.some(
        (msg) =>
          typeof msg.content === "string" && msg.content.includes(signature),
      );

      return !alreadyNotified;
    });

    if (newEvents.length === 0) {
      return { shouldNotify: false };
    }

    // Build notification message
    const event = newEvents[0]; // Focus on the soonest event
    const eventStart = event.start?.dateTime || event.start?.date;
    const startTime = eventStart ? new Date(eventStart) : null;

    const minutesUntil = startTime
      ? Math.round((startTime.getTime() - now.getTime()) / (1000 * 60))
      : null;

    const timeDesc =
      minutesUntil !== null
        ? minutesUntil <= 5
          ? "starting now"
          : `in ${minutesUntil} minutes`
        : "soon";

    const attendees = event.attendees?.length || 0;
    const attendeesInfo =
      attendees > 1 ? ` with ${attendees - 1} other${attendees > 2 ? "s" : ""}` : "";

    const locationInfo = event.location ? ` at ${event.location}` : "";
    const meetLinkInfo = event.hangoutLink ? ` (Meet link available)` : "";

    const message =
      `[SYSTEM: Proactive calendar reminder - share with user naturally]\n` +
      `[calendar:reminder:${event.id}]\n` +
      `Upcoming event ${timeDesc}: "${event.summary}"${locationInfo}${attendeesInfo}${meetLinkInfo}`;

    return {
      shouldNotify: true,
      message,
      contentSignature: `calendar:reminder:${event.id}`,
      metadata: {
        eventId: event.id,
        eventSummary: event.summary,
        minutesUntil,
        hasLocation: !!event.location,
        hasMeetLink: !!event.hangoutLink,
      },
    };
  } catch (error) {
    console.error("[checkCalendar] Error checking calendar:", error);
    return { shouldNotify: false };
  }
}

