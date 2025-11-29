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
  console.log(
    "[getCalendarConnection] Looking up connection for userId:",
    userId,
  );

  const connection = await getConnection(userId, "google_calendar");

  console.log("[getCalendarConnection] Connection lookup result:", {
    found: !!connection,
    status: connection?.status,
    pipedreamAccountId: connection?.pipedreamAccountId,
  });

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

  console.log("[calendarProxyGet] Making request:", { url, params, accountId });

  try {
    const response = await pipedream.proxy.get({
      url,
      accountId,
      externalUserId,
      params,
    });

    console.log("[calendarProxyGet] Response type:", typeof response);
    console.log(
      "[calendarProxyGet] Response keys:",
      response && typeof response === "object" ? Object.keys(response) : "N/A",
    );
    console.log(
      "[calendarProxyGet] Full response:",
      JSON.stringify(response, null, 2),
    );

    // The response might be the body directly, not wrapped
    return response as T;
  } catch (error) {
    console.error("[calendarProxyGet] Error:", error);
    throw error;
  }
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

  console.log("[calendarProxyPost] Making request:", {
    url,
    body,
    params,
    accountId,
  });

  try {
    const response = await pipedream.proxy.post({
      url,
      accountId,
      externalUserId,
      body: body as Record<string, unknown>,
      params,
    });

    console.log("[calendarProxyPost] Response type:", typeof response);
    console.log(
      "[calendarProxyPost] Response keys:",
      response && typeof response === "object" ? Object.keys(response) : "N/A",
    );
    console.log(
      "[calendarProxyPost] Full response:",
      JSON.stringify(response, null, 2),
    );

    // The response might be the body directly, not wrapped
    return response as T;
  } catch (error) {
    console.error("[calendarProxyPost] Error:", error);
    throw error;
  }
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
