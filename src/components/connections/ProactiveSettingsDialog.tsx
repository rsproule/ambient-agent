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
import { Calendar, Github, Mail } from "lucide-react";
import { useEffect, useState } from "react";

interface HookSettings {
  enabled: boolean;
  cooldownMinutes: number;
}

type HookSettingsMap = Partial<Record<HookName, HookSettings>>;

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

// Only show the integration-specific hooks in their dialogs
const HOOK_CONFIG: Record<
  string,
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
    const initial: HookSettingsMap = {};
    for (const hook of relevantHooks) {
      initial[hook] = {
        enabled: true,
        cooldownMinutes: DEFAULT_HOOK_SCHEDULES[hook],
      };
    }
    return initial;
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Fetch current settings
  useEffect(() => {
    if (open) {
      fetchSettings();
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
            for (const hook of relevantHooks) {
              if (data.hookCooldowns[hook] !== undefined) {
                updated[hook] = {
                  enabled: data.hookCooldowns[hook] !== 0,
                  cooldownMinutes: data.hookCooldowns[hook] || DEFAULT_HOOK_SCHEDULES[hook],
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

  const handleToggleHook = (hook: HookName) => {
    setHookSettings((prev) => ({
      ...prev,
      [hook]: {
        ...prev[hook],
        enabled: !prev[hook]?.enabled,
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

      for (const [hook, settings] of Object.entries(hookSettings)) {
        if (settings) {
          // 0 means disabled
          hookCooldowns[hook] = settings.enabled ? settings.cooldownMinutes : 0;
        }
      }

      await fetch(`/api/connections/settings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          hookCooldowns,
        }),
      });

      onOpenChange(false);
    } catch (error) {
      console.error("Error saving settings:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDisconnectClick = () => {
    onOpenChange(false);
    onDisconnect();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{providerName} Settings</DialogTitle>
          <DialogDescription>
            Configure proactive notifications for {providerName}.
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
                {relevantHooks.map((hook) => {
                  const config = HOOK_CONFIG[hook];
                  if (!config) return null;
                  
                  const Icon = config.icon;
                  const settings = hookSettings[hook];
                  if (!settings) return null;

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
