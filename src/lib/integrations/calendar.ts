/**
 * Google Calendar Integration Utilities
 *
 * Example utilities for working with connected Google Calendar accounts
 */

import { getConnection, updateConnection } from "@/src/db/connection";
import { pipedreamClient } from "@/src/lib/pipedream/client";
import type { calendar_v3 } from "googleapis";
import { google } from "googleapis";

/**
 * Get an authenticated Calendar client, refreshing token if necessary
 */
async function getCalendarClient(
  userId: string,
): Promise<calendar_v3.Calendar> {
  const connection = await getConnection(userId, "google_calendar");

  if (!connection || connection.status !== "connected") {
    throw new Error("Google Calendar not connected");
  }

  // Check if token needs refresh
  if (connection.expiresAt && new Date() > connection.expiresAt) {
    if (!connection.pipedreamAccountId) {
      throw new Error("Missing Pipedream account ID");
    }

    const refreshed = await pipedreamClient.refreshToken(
      connection.pipedreamAccountId,
    );

    // Update connection with new tokens
    await updateConnection(userId, "google_calendar", {
      accessToken: refreshed.auth_provision?.oauth_access_token,
      refreshToken: refreshed.auth_provision?.oauth_refresh_token,
      expiresAt: refreshed.auth_provision?.expires_at
        ? new Date(refreshed.auth_provision.expires_at * 1000)
        : undefined,
      lastSyncedAt: new Date(),
    });

    // Create OAuth2 client with refreshed token
    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({
      access_token: refreshed.auth_provision?.oauth_access_token,
      refresh_token: refreshed.auth_provision?.oauth_refresh_token,
      expiry_date: refreshed.auth_provision?.expires_at
        ? refreshed.auth_provision.expires_at * 1000
        : undefined,
    });

    return google.calendar({ version: "v3", auth: oauth2Client });
  }

  if (!connection.accessToken) {
    throw new Error("No access token available");
  }

  // Create OAuth2 client with existing token
  const oauth2Client = new google.auth.OAuth2();
  oauth2Client.setCredentials({
    access_token: connection.accessToken,
    refresh_token: connection.refreshToken || undefined,
    expiry_date: connection.expiresAt
      ? connection.expiresAt.getTime()
      : undefined,
  });

  return google.calendar({ version: "v3", auth: oauth2Client });
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
  const calendar = await getCalendarClient(userId);
  const calendarId = options?.calendarId || "primary";

  const response = await calendar.events.list({
    calendarId,
    maxResults: options?.maxResults || 10,
    singleEvents: true,
    orderBy: "startTime",
    timeMin: (options?.timeMin || new Date()).toISOString(),
    timeMax: options?.timeMax?.toISOString(),
    pageToken: options?.pageToken,
  });

  return response.data;
}

/**
 * Get a specific calendar event
 */
export async function getCalendarEvent(
  userId: string,
  eventId: string,
  calendarId = "primary",
): Promise<calendar_v3.Schema$Event> {
  const calendar = await getCalendarClient(userId);

  const response = await calendar.events.get({
    calendarId,
    eventId,
  });

  return response.data;
}

/**
 * Create a calendar event
 */
export async function createCalendarEvent(
  userId: string,
  event: calendar_v3.Schema$Event,
  calendarId = "primary",
): Promise<calendar_v3.Schema$Event> {
  const calendar = await getCalendarClient(userId);

  const response = await calendar.events.insert({
    calendarId,
    requestBody: event,
  });

  return response.data;
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
