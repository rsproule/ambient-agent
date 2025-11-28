/**
 * Provider configurations for different OAuth integrations
 */

export interface ProviderConfig {
  id: string;
  name: string;
  app: string; // Pipedream app identifier
  icon: string;
  scopes: string[];
  description: string;
}

export const PROVIDERS: Record<string, ProviderConfig> = {
  google_gmail: {
    id: "google_gmail",
    name: "Gmail",
    app: "gmail",
    icon: "📧",
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
    icon: "📅",
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
    icon: "🐙",
    scopes: [
      "repo",
      "read:user",
      "user:email",
    ],
    description: "Access your GitHub repositories and profile",
  },
};

export function getProviderConfig(providerId: string): ProviderConfig | undefined {
  return PROVIDERS[providerId];
}

export function getAllProviders(): ProviderConfig[] {
  return Object.values(PROVIDERS);
}

