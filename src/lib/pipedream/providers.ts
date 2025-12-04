/**
 * Provider configurations for different OAuth integrations
 */

import type { LucideIcon } from "lucide-react";
import { Mail, Calendar, Github, Twitter } from "lucide-react";

export interface ProviderConfig {
  id: string;
  name: string;
  app: string; // Pipedream app identifier
  icon: LucideIcon;
  scopes: string[];
  description: string;
}

export const PROVIDERS: Record<string, ProviderConfig> = {
  google_gmail: {
    id: "google_gmail",
    name: "Gmail",
    app: "gmail",
    icon: Mail,
    scopes: [
      "https://www.googleapis.com/auth/gmail.readonly",
      "https://www.googleapis.com/auth/gmail.compose",
      "https://www.googleapis.com/auth/gmail.send",
    ],
    description: "Read and send emails from your Gmail account",
  },
  google_calendar: {
    id: "google_calendar",
    name: "Google Calendar",
    app: "google_calendar",
    icon: Calendar,
    scopes: [
      "https://www.googleapis.com/auth/calendar.readonly",
      "https://www.googleapis.com/auth/calendar.events",
    ],
    description: "Access your Google Calendar events and schedules",
  },
  github: {
    id: "github",
    name: "GitHub",
    app: "github",
    icon: Github,
    scopes: [
      "repo",
      "read:user",
      "user:email",
    ],
    description: "Access your GitHub repositories and profile",
  },
  twitter: {
    id: "twitter",
    name: "Twitter/X",
    app: "twitter",
    icon: Twitter,
    scopes: [
      "tweet.read",
      "tweet.write",
      "users.read",
      "follows.read",
      "offline.access",
    ],
    description: "Access your Twitter feed, search tweets, and draft posts",
  },
};

export function getProviderConfig(providerId: string): ProviderConfig | undefined {
  return PROVIDERS[providerId];
}

export function getAllProviders(): ProviderConfig[] {
  return Object.values(PROVIDERS);
}

