"use client";

import { Button } from "@/src/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/src/components/ui/dialog";
import { Label } from "@/src/components/ui/label";
import { Switch } from "@/src/components/ui/switch";
import { DEFAULT_HOOK_SCHEDULES, type HookName } from "@/src/lib/proactive/types";
import { Calendar, Github, Mail, Link2, Clock, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";

interface HookSettings {
  enabled: boolean;
  cooldownMinutes: number;
}

type HookSettingsMap = Record<HookName, HookSettings>;

interface ScheduledJob {
  id: string;
  name: string;
  prompt: string;
  cronSchedule: string;
  enabled: boolean;
  nextRunAt?: string;
}

interface ProactiveSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  providerId: string; // e.g. "google_gmail", "github", "google_calendar"
  providerName: string;
  onDisconnect: () => void;
}

// Map provider IDs to relevant hooks
const PROVIDER_HOOKS: Record<string, HookName[]> = {
  google_gmail: ["gmail"],
  github: ["github"],
  google_calendar: ["calendar"],
};

const HOOK_CONFIG: Record<
  HookName,
  { label: string; description: string; icon: React.ElementType }
> = {
  calendar: {
    label: "Calendar Reminders",
    description: "Get notified about upcoming meetings",
    icon: Calendar,
  },
  github: {
    label: "GitHub Notifications",
    description: "PR reviews and mentions",
    icon: Github,
  },
  gmail: {
    label: "Email Alerts",
    description: "Important unread emails",
    icon: Mail,
  },
  connectionReminder: {
    label: "Connection Reminders",
    description: "Remind to connect accounts",
    icon: Link2,
  },
  scheduledJobs: {
    label: "Scheduled Jobs",
    description: "Run your custom scheduled tasks",
    icon: Clock,
  },
};

const COOLDOWN_OPTIONS = [
  { value: 15, label: "15 min" },
  { value: 30, label: "30 min" },
  { value: 60, label: "1 hour" },
  { value: 120, label: "2 hours" },
  { value: 240, label: "4 hours" },
  { value: 1440, label: "Daily" },
  { value: 10080, label: "Weekly" },
];

export function ProactiveSettingsDialog({
  open,
  onOpenChange,
  userId,
  providerId,
  providerName,
  onDisconnect,
}: ProactiveSettingsDialogProps) {
  // Get hooks relevant to this provider
  const relevantHooks = PROVIDER_HOOKS[providerId] || [];
  const [hookSettings, setHookSettings] = useState<HookSettingsMap>(() => {
    const initial: Partial<HookSettingsMap> = {};
    for (const hook of Object.keys(HOOK_CONFIG) as HookName[]) {
      initial[hook] = {
        enabled: true,
        cooldownMinutes: DEFAULT_HOOK_SCHEDULES[hook],
      };
    }
    return initial as HookSettingsMap;
  });
  const [scheduledJobs, setScheduledJobs] = useState<ScheduledJob[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Fetch current settings and scheduled jobs
  useEffect(() => {
    if (open) {
      fetchSettings();
      fetchScheduledJobs();
    }
  }, [open, userId]);

  const fetchSettings = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/connections/settings?userId=${userId}`);
      if (response.ok) {
        const data = await response.json();
        if (data.hookCooldowns) {
          setHookSettings((prev) => {
            const updated = { ...prev };
            for (const [hook, cooldown] of Object.entries(data.hookCooldowns)) {
              if (updated[hook as HookName]) {
                updated[hook as HookName] = {
                  ...updated[hook as HookName],
                  cooldownMinutes: cooldown as number,
                };
              }
            }
            return updated;
          });
        }
        if (data.disabledHooks) {
          setHookSettings((prev) => {
            const updated = { ...prev };
            for (const hook of data.disabledHooks) {
              if (updated[hook as HookName]) {
                updated[hook as HookName] = {
                  ...updated[hook as HookName],
                  enabled: false,
                };
              }
            }
            return updated;
          });
        }
      }
    } catch (error) {
      console.error("Error fetching settings:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchScheduledJobs = async () => {
    try {
      const response = await fetch(`/api/connections/scheduled-jobs?userId=${userId}`);
      if (response.ok) {
        const data = await response.json();
        setScheduledJobs(data.jobs || []);
      }
    } catch (error) {
      console.error("Error fetching scheduled jobs:", error);
    }
  };

  const handleToggleHook = (hook: HookName) => {
    setHookSettings((prev) => ({
      ...prev,
      [hook]: {
        ...prev[hook],
        enabled: !prev[hook].enabled,
      },
    }));
  };

  const handleCooldownChange = (hook: HookName, value: number) => {
    setHookSettings((prev) => ({
      ...prev,
      [hook]: {
        ...prev[hook],
        cooldownMinutes: value,
      },
    }));
  };

  const handleSaveSettings = async () => {
    setIsSaving(true);
    try {
      const hookCooldowns: Record<string, number> = {};
      const disabledHooks: string[] = [];

      for (const [hook, settings] of Object.entries(hookSettings)) {
        hookCooldowns[hook] = settings.cooldownMinutes;
        if (!settings.enabled) {
          disabledHooks.push(hook);
        }
      }

      await fetch(`/api/connections/settings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          hookCooldowns,
          disabledHooks,
        }),
      });

      onOpenChange(false);
    } catch (error) {
      console.error("Error saving settings:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteJob = async (jobId: string) => {
    if (!confirm("Are you sure you want to delete this scheduled job?")) {
      return;
    }

    try {
      await fetch(`/api/connections/scheduled-jobs/${jobId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      setScheduledJobs((prev) => prev.filter((j) => j.id !== jobId));
    } catch (error) {
      console.error("Error deleting job:", error);
    }
  };

  const handleDisconnectClick = () => {
    onOpenChange(false);
    onDisconnect();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Proactive Settings</DialogTitle>
          <DialogDescription>
            Configure when and how {providerName} notifications are sent.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="py-8 text-center text-muted-foreground">
            Loading settings...
          </div>
        ) : (
          <div className="space-y-6">
            {/* Hook Settings - only show relevant hooks for this provider */}
            {relevantHooks.length > 0 && (
              <div className="space-y-4">
                <h3 className="text-sm font-medium">Notification Settings</h3>
                {relevantHooks.map((hook) => {
                  const config = HOOK_CONFIG[hook];
                  const Icon = config.icon;
                  const settings = hookSettings[hook];

                  return (
                    <div
                      key={hook}
                      className="flex items-start justify-between gap-4 rounded-lg border p-3"
                    >
                      <div className="flex items-start gap-3">
                        <Icon className="h-4 w-4 mt-0.5 text-muted-foreground" />
                        <div className="space-y-1">
                          <Label
                            htmlFor={`${hook}-toggle`}
                            className="text-sm font-medium cursor-pointer"
                          >
                            {config.label}
                          </Label>
                          <p className="text-xs text-muted-foreground">
                            {config.description}
                          </p>
                          {settings.enabled && (
                            <select
                              value={settings.cooldownMinutes}
                              onChange={(e) =>
                                handleCooldownChange(hook, Number(e.target.value))
                              }
                              className="mt-2 text-xs border rounded px-2 py-1 bg-background"
                            >
                              {COOLDOWN_OPTIONS.map((opt) => (
                                <option key={opt.value} value={opt.value}>
                                  Every {opt.label}
                                </option>
                              ))}
                            </select>
                          )}
                        </div>
                      </div>
                      <Switch
                        id={`${hook}-toggle`}
                        checked={settings.enabled}
                        onCheckedChange={() => handleToggleHook(hook)}
                      />
                    </div>
                  );
                })}
              </div>
            )}

            {/* Scheduled Jobs */}
            {scheduledJobs.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-medium">Your Scheduled Jobs</h3>
                {scheduledJobs.map((job) => (
                  <div
                    key={job.id}
                    className="flex items-center justify-between gap-2 rounded-lg border p-3"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium truncate">{job.name}</div>
                      <div className="text-xs text-muted-foreground truncate">
                        {job.prompt}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteJob(job.id)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {/* Actions */}
            <div className="flex flex-col gap-2 pt-4 border-t">
              <Button onClick={handleSaveSettings} disabled={isSaving}>
                {isSaving ? "Saving..." : "Save Settings"}
              </Button>
              <Button
                variant="outline"
                onClick={handleDisconnectClick}
                className="text-destructive hover:text-destructive"
              >
                Disconnect {providerName}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

