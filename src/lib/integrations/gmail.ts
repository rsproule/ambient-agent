/**
 * Gmail Integration Utilities
 *
 * Uses Pipedream Connect's proxy to make authenticated Gmail API calls
 * Documentation: https://pipedream.com/docs/connect/quickstart
 */

import { getConnection } from "@/src/db/connection";
import { pipedream } from "@/src/lib/pipedream/client";

/**
 * Get connection info for making proxied Gmail API calls
 */
async function getGmailConnection(userId: string) {
  const connection = await getConnection(userId, "google_gmail");

  if (!connection || connection.status !== "connected") {
    throw new Error("Gmail not connected");
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
 * Make an authenticated GET request to Gmail API via Pipedream proxy
 */
async function gmailProxyGet<T>(
  userId: string,
  path: string,
  params?: Record<string, string | object | string[] | object[] | null>,
): Promise<T> {
  const { accountId, externalUserId } = await getGmailConnection(userId);

  const url = `https://gmail.googleapis.com/gmail/v1${path}`;

  const response = await pipedream.proxy.get({
    url,
    accountId,
    externalUserId,
    params,
  });

  return response as T;
}

/**
 * Make an authenticated POST request to Gmail API via Pipedream proxy
 */
async function gmailProxyPost<T>(
  userId: string,
  path: string,
  body?: Record<string, unknown>,
  params?: Record<string, string | object | string[] | object[] | null>,
): Promise<T> {
  const { accountId, externalUserId } = await getGmailConnection(userId);

  const url = `https://gmail.googleapis.com/gmail/v1${path}`;

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
 * Search Gmail messages
 */
export async function searchGmailMessages(
  userId: string,
  query: string,
  maxResults = 10,
): Promise<{
  messages?: Array<{ id?: string; threadId?: string }>;
  resultSizeEstimate?: number;
}> {
  return gmailProxyGet(userId, "/users/me/messages", {
    q: query,
    maxResults: String(maxResults),
  });
}

/**
 * List Gmail messages
 */
export async function listGmailMessages(
  userId: string,
  options?: {
    maxResults?: number;
    pageToken?: string;
    labelIds?: string[];
  },
): Promise<{
  messages?: Array<{ id?: string; threadId?: string }>;
  resultSizeEstimate?: number;
}> {
  const params: Record<string, string | object | string[] | object[] | null> = {
    maxResults: String(options?.maxResults || 10),
  };

  if (options?.pageToken) {
    params.pageToken = options.pageToken;
  }

  if (options?.labelIds && options.labelIds.length > 0) {
    params.labelIds = options.labelIds;
  }

  return gmailProxyGet(userId, "/users/me/messages", params);
}

/**
 * Get a specific Gmail message
 */
export async function getGmailMessage(
  userId: string,
  messageId: string,
): Promise<{
  id?: string;
  threadId?: string;
  labelIds?: string[];
  snippet?: string;
  payload?: {
    headers?: Array<{ name?: string; value?: string }>;
    body?: { data?: string };
  };
}> {
  return gmailProxyGet(
    userId,
    `/users/me/messages/${encodeURIComponent(messageId)}`,
    {
      format: "full",
    },
  );
}

/**
 * Send a Gmail message
 */
export async function sendGmailMessage(
  userId: string,
  options: {
    to: string;
    subject: string;
    body: string;
    isHtml?: boolean;
  },
): Promise<{ id?: string; threadId?: string; labelIds?: string[] }> {
  // Construct RFC 2822 formatted message
  const contentType = options.isHtml ? "text/html" : "text/plain";
  const message = [
    `To: ${options.to}`,
    `Subject: ${options.subject}`,
    `Content-Type: ${contentType}; charset=utf-8`,
    "",
    options.body,
  ].join("\r\n");

  // Base64url encode the message
  const encodedMessage = Buffer.from(message)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  return gmailProxyPost(userId, "/users/me/messages/send", {
    raw: encodedMessage,
  });
}
