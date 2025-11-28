/**
 * Gmail Integration Utilities
 *
 * Example utilities for working with connected Gmail accounts
 */

import { getConnection, updateConnection } from "@/src/db/connection";
import { getRefreshedAccount } from "@/src/lib/pipedream/client";
import type { gmail_v1 } from "googleapis";
import { google } from "googleapis";

/**
 * Get an authenticated Gmail client, refreshing token if necessary
 */
async function getGmailClient(userId: string): Promise<gmail_v1.Gmail> {
  const connection = await getConnection(userId, "google_gmail");

  if (!connection || connection.status !== "connected") {
    throw new Error("Gmail not connected");
  }

  // Check if token needs refresh
  if (connection.expiresAt && new Date() > connection.expiresAt) {
    if (!connection.pipedreamAccountId) {
      throw new Error("Missing Pipedream account ID");
    }

    const refreshed = await getRefreshedAccount(connection.pipedreamAccountId);

    // Extract OAuth credentials from the credentials object
    const credentials = refreshed.credentials as
      | Record<string, unknown>
      | undefined;
    const oauthAccessToken = credentials?.oauth_access_token as
      | string
      | undefined;
    const oauthRefreshToken = credentials?.oauth_refresh_token as
      | string
      | undefined;

    // Update connection with new tokens
    await updateConnection(userId, "google_gmail", {
      accessToken: oauthAccessToken,
      refreshToken: oauthRefreshToken,
      expiresAt: refreshed.expiresAt,
      lastSyncedAt: new Date(),
    });

    // Create OAuth2 client with refreshed token
    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({
      access_token: oauthAccessToken,
      refresh_token: oauthRefreshToken,
      expiry_date: refreshed.expiresAt?.getTime(),
    });

    return google.gmail({ version: "v1", auth: oauth2Client });
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

  return google.gmail({ version: "v1", auth: oauth2Client });
}

/**
 * List messages from user's Gmail inbox
 */
export async function listGmailMessages(
  userId: string,
  options?: {
    maxResults?: number;
    pageToken?: string;
    q?: string;
  },
): Promise<gmail_v1.Schema$ListMessagesResponse> {
  const gmail = await getGmailClient(userId);

  const response = await gmail.users.messages.list({
    userId: "me",
    maxResults: options?.maxResults || 10,
    pageToken: options?.pageToken,
    q: options?.q,
  });

  return response.data;
}

/**
 * Get a specific Gmail message
 */
export async function getGmailMessage(
  userId: string,
  messageId: string,
): Promise<gmail_v1.Schema$Message> {
  const gmail = await getGmailClient(userId);

  const response = await gmail.users.messages.get({
    userId: "me",
    id: messageId,
  });

  return response.data;
}

/**
 * Send an email via Gmail
 */
export async function sendGmailMessage(
  userId: string,
  options: {
    to: string;
    subject: string;
    body: string;
    isHtml?: boolean;
  },
): Promise<gmail_v1.Schema$Message> {
  const gmail = await getGmailClient(userId);

  // Create the email in RFC 2822 format
  const email = [
    `To: ${options.to}`,
    `Subject: ${options.subject}`,
    `Content-Type: ${
      options.isHtml ? "text/html" : "text/plain"
    }; charset=utf-8`,
    "",
    options.body,
  ].join("\r\n");

  // Base64url encode the email
  const encodedEmail = Buffer.from(email)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  const response = await gmail.users.messages.send({
    userId: "me",
    requestBody: {
      raw: encodedEmail,
    },
  });

  return response.data;
}

/**
 * Search Gmail messages
 */
export async function searchGmailMessages(
  userId: string,
  query: string,
  maxResults = 10,
): Promise<gmail_v1.Schema$ListMessagesResponse> {
  return listGmailMessages(userId, { q: query, maxResults });
}
