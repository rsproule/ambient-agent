/**
 * Google Calendar Integration Tool for AI Agent
 *
 * Provides Calendar access for authenticated users via AI SDK tool interface.
 * In group messages, always authenticates as the message sender.
 */

import type { ConversationContext } from "@/src/db/conversation";
import {
  createCalendarEvent,
  getTodaysEvents,
  getWeeklyEvents,
  listCalendarEvents,
} from "@/src/lib/integrations/calendar";
import { tool, zodSchema } from "ai";
import type { calendar_v3 } from "googleapis";
import { z } from "zod";
import { getAuthenticatedUserId } from "./helpers";

/**
 * Format calendar event for AI consumption
 */
function formatEvent(event: calendar_v3.Schema$Event) {
  return {
    id: event.id,
    summary: event.summary,
    description: event.description,
    location: event.location,
    start:
      event.start?.dateTime || event.start?.date || "No start time specified",
    end: event.end?.dateTime || event.end?.date || "No end time specified",
    status: event.status,
    htmlLink: event.htmlLink,
    attendees: event.attendees?.map((a) => ({
      email: a.email,
      responseStatus: a.responseStatus,
    })),
  };
}

/**
 * Create Calendar tools bound to a specific conversation context
 */
export function createCalendarTools(context: ConversationContext) {
  return {
    calendar_list_events: tool({
      description:
        "List upcoming calendar events. By default shows events starting from now. " +
        "Only available if the user has connected their Google Calendar.",
      inputSchema: zodSchema(
        z.object({
          maxResults: z
            .number()
            .optional()
            .describe("Maximum number of events to return (default: 10)"),
          timeMin: z
            .string()
            .optional()
            .describe(
              "Start time (ISO 8601 format, default: now). Example: 2024-01-01T00:00:00Z",
            ),
          timeMax: z
            .string()
            .optional()
            .describe(
              "End time (ISO 8601 format). Example: 2024-12-31T23:59:59Z",
            ),
        }),
      ),
      execute: async ({ maxResults, timeMin, timeMax }) => {
        try {
          const userId = await getAuthenticatedUserId(context);

          if (!userId) {
            return {
              success: false,
              message: context.isGroup
                ? "Cannot access Calendar in group messages - sender not identified"
                : "User not found. They may need to set up their account first.",
            };
          }

          const response = await listCalendarEvents(userId, {
            maxResults: maxResults || 10,
            timeMin: timeMin ? new Date(timeMin) : undefined,
            timeMax: timeMax ? new Date(timeMax) : undefined,
          });

          const events = response.items || [];

          if (events.length === 0) {
            return {
              success: true,
              message: "No upcoming events found.",
              events: [],
            };
          }

          return {
            success: true,
            message: `Found ${events.length} event(s)`,
            events: events.map(formatEvent),
          };
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : "Unknown error";

          if (errorMessage.includes("not connected")) {
            return {
              success: false,
              message:
                "Google Calendar is not connected. The user needs to connect their Google Calendar first.",
            };
          }

          return {
            success: false,
            message: `Failed to list calendar events: ${errorMessage}`,
          };
        }
      },
    }),

    calendar_get_today: tool({
      description:
        "Get all calendar events for today. " +
        "Only available if the user has connected their Google Calendar.",
      inputSchema: zodSchema(z.object({})),
      execute: async () => {
        try {
          const userId = await getAuthenticatedUserId(context);

          if (!userId) {
            return {
              success: false,
              message: context.isGroup
                ? "Cannot access Calendar in group messages - sender not identified"
                : "User not found. They may need to set up their account first.",
            };
          }

          const response = await getTodaysEvents(userId);
          const events = response.items || [];

          if (events.length === 0) {
            return {
              success: true,
              message: "No events scheduled for today.",
              events: [],
            };
          }

          return {
            success: true,
            message: `You have ${events.length} event(s) today`,
            events: events.map(formatEvent),
          };
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : "Unknown error";

          if (errorMessage.includes("not connected")) {
            return {
              success: false,
              message:
                "Google Calendar is not connected. The user needs to connect their Google Calendar first.",
            };
          }

          return {
            success: false,
            message: `Failed to get today's events: ${errorMessage}`,
          };
        }
      },
    }),

    calendar_get_week: tool({
      description:
        "Get all calendar events for the next 7 days. " +
        "Only available if the user has connected their Google Calendar.",
      inputSchema: zodSchema(z.object({})),
      execute: async () => {
        try {
          const userId = await getAuthenticatedUserId(context);

          if (!userId) {
            return {
              success: false,
              message: context.isGroup
                ? "Cannot access Calendar in group messages - sender not identified"
                : "User not found. They may need to set up their account first.",
            };
          }

          const response = await getWeeklyEvents(userId);
          const events = response.items || [];

          if (events.length === 0) {
            return {
              success: true,
              message: "No events scheduled for the next 7 days.",
              events: [],
            };
          }

          return {
            success: true,
            message: `You have ${events.length} event(s) this week`,
            events: events.map(formatEvent),
          };
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : "Unknown error";

          if (errorMessage.includes("not connected")) {
            return {
              success: false,
              message:
                "Google Calendar is not connected. The user needs to connect their Google Calendar first.",
            };
          }

          return {
            success: false,
            message: `Failed to get this week's events: ${errorMessage}`,
          };
        }
      },
    }),

    calendar_create_event: tool({
      description:
        "Create a new calendar event. " +
        "Only available if the user has connected their Google Calendar.",
      inputSchema: zodSchema(
        z.object({
          summary: z.string().describe("Event title/summary"),
          description: z
            .string()
            .optional()
            .describe("Event description (optional)"),
          location: z.string().optional().describe("Event location (optional)"),
          startTime: z
            .string()
            .describe(
              "Start time (ISO 8601 format). Example: 2024-01-01T10:00:00Z",
            ),
          endTime: z
            .string()
            .describe(
              "End time (ISO 8601 format). Example: 2024-01-01T11:00:00Z",
            ),
          attendees: z
            .array(z.string())
            .optional()
            .describe("List of attendee email addresses (optional)"),
        }),
      ),
      execute: async ({
        summary,
        description,
        location,
        startTime,
        endTime,
        attendees,
      }) => {
        try {
          const userId = await getAuthenticatedUserId(context);

          if (!userId) {
            return {
              success: false,
              message: context.isGroup
                ? "Cannot access Calendar in group messages - sender not identified"
                : "User not found. They may need to set up their account first.",
            };
          }

          const event: calendar_v3.Schema$Event = {
            summary,
            description,
            location,
            start: {
              dateTime: startTime,
              timeZone: "UTC", // Could be made configurable
            },
            end: {
              dateTime: endTime,
              timeZone: "UTC",
            },
            attendees: attendees?.map((email) => ({ email })),
          };

          const createdEvent = await createCalendarEvent(userId, event);

          return {
            success: true,
            message: `Event created: ${summary}`,
            event: formatEvent(createdEvent),
          };
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : "Unknown error";

          if (errorMessage.includes("not connected")) {
            return {
              success: false,
              message:
                "Google Calendar is not connected. The user needs to connect their Google Calendar first.",
            };
          }

          return {
            success: false,
            message: `Failed to create calendar event: ${errorMessage}`,
          };
        }
      },
    }),
  };
}
