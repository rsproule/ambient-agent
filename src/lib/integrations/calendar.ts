/**
 * Google Calendar Integration Utilities
 *
 * Uses Pipedream Connect's proxy to make authenticated Google Calendar API calls
 * Documentation: https://pipedream.com/docs/connect/quickstart
 */

import { getConnection } from "@/src/db/connection";
import { pipedream } from "@/src/lib/pipedream/client";
import type { calendar_v3 } from "googleapis";

/**
 * Get connection info for making proxied Calendar API calls
 */
async function getCalendarConnection(userId: string) {
  const connection = await getConnection(userId, "google_calendar");

  if (!connection || connection.status !== "connected") {
    throw new Error("Google Calendar not connected");
  }

  if (!connection.pipedreamAccountId) {
    throw new Error("Missing Pipedream account ID");
  }

  return {
    accountId: connection.pipedreamAccountId,
    externalUserId: connection.userId,
  };
}

/**
 * Make an authenticated GET request to Google Calendar API via Pipedream proxy
 */
async function calendarProxyGet<T>(
  userId: string,
  path: string,
  params?: Record<string, string | object | string[] | object[] | null>,
): Promise<T> {
  const { accountId, externalUserId } = await getCalendarConnection(userId);

  const url = `https://www.googleapis.com/calendar/v3${path}`;

  const response = await pipedream.proxy.get({
    url,
    accountId,
    externalUserId,
    params,
  });

  return response as T;
}

/**
 * Make an authenticated POST request to Google Calendar API via Pipedream proxy
 */
async function calendarProxyPost<T>(
  userId: string,
  path: string,
  body?: Record<string, unknown>,
  params?: Record<string, string | object | string[] | object[] | null>,
): Promise<T> {
  const { accountId, externalUserId } = await getCalendarConnection(userId);

  const url = `https://www.googleapis.com/calendar/v3${path}`;

  const response = await pipedream.proxy.post({
    url,
    accountId,
    externalUserId,
    body: body as Record<string, unknown>,
    params,
  });

  return response as T;
}

/**
 * List upcoming calendar events
 */
export async function listCalendarEvents(
  userId: string,
  options?: {
    calendarId?: string;
    timeMin?: Date;
    timeMax?: Date;
    maxResults?: number;
    pageToken?: string;
  },
): Promise<calendar_v3.Schema$Events> {
  const calendarId = options?.calendarId || "primary";

  const params: Record<string, string | object | string[] | object[] | null> = {
    maxResults: String(options?.maxResults || 10),
    singleEvents: "true",
    orderBy: "startTime",
    timeMin: (options?.timeMin || new Date()).toISOString(),
  };

  if (options?.timeMax) {
    params.timeMax = options.timeMax.toISOString();
  }

  if (options?.pageToken) {
    params.pageToken = options.pageToken;
  }

  return calendarProxyGet(
    userId,
    `/calendars/${encodeURIComponent(calendarId)}/events`,
    params,
  );
}

/**
 * Get a specific calendar event
 */
export async function getCalendarEvent(
  userId: string,
  eventId: string,
  calendarId = "primary",
): Promise<calendar_v3.Schema$Event> {
  return calendarProxyGet(
    userId,
    `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(
      eventId,
    )}`,
  );
}

/**
 * Create a calendar event
 */
export async function createCalendarEvent(
  userId: string,
  event: calendar_v3.Schema$Event,
  calendarId = "primary",
): Promise<calendar_v3.Schema$Event> {
  return calendarProxyPost(
    userId,
    `/calendars/${encodeURIComponent(calendarId)}/events`,
    event as unknown as Record<string, unknown>,
  );
}

/**
 * Get today's calendar events
 */
export async function getTodaysEvents(
  userId: string,
  calendarId = "primary",
): Promise<calendar_v3.Schema$Events> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  return listCalendarEvents(userId, {
    calendarId,
    timeMin: today,
    timeMax: tomorrow,
  });
}

/**
 * Get this week's calendar events
 */
export async function getWeeklyEvents(
  userId: string,
  calendarId = "primary",
): Promise<calendar_v3.Schema$Events> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const nextWeek = new Date(today);
  nextWeek.setDate(nextWeek.getDate() + 7);

  return listCalendarEvents(userId, {
    calendarId,
    timeMin: today,
    timeMax: nextWeek,
    maxResults: 100,
  });
}

/**
 * Get user's calendar settings (includes timezone)
 */
export async function getCalendarSettings(
  userId: string,
): Promise<calendar_v3.Schema$Setting[]> {
  const response = await calendarProxyGet<{
    items: calendar_v3.Schema$Setting[];
  }>(userId, "/users/me/settings");
  return response.items || [];
}

/**
 * Get user's timezone from Google Calendar
 * Returns null if calendar not connected or timezone not found
 */
export async function getUserTimezoneFromCalendar(
  userId: string,
): Promise<string | null> {
  try {
    const settings = await getCalendarSettings(userId);
    const timezoneSetting = settings.find((s) => s.id === "timezone");
    return timezoneSetting?.value || null;
  } catch {
    // Calendar not connected or API error
    return null;
  }
}
