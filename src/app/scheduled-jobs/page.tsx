"use client";

import { Loader } from "@/src/components/loader";
import { Button } from "@/src/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/src/components/ui/dialog";
import { Input } from "@/src/components/ui/input";
import { Label } from "@/src/components/ui/label";
import { Switch } from "@/src/components/ui/switch";
import {
  Clock,
  Link2Off,
  Loader2,
  Pencil,
  Play,
  Shield,
  Sparkles,
  Trash2,
} from "lucide-react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

interface ScheduledJob {
  id: string;
  name: string;
  prompt: string;
  cronSchedule: string;
  enabled: boolean;
  notifyMode: "always" | "significant";
  nextRunAt?: string;
  lastRunAt?: string;
  isDefault?: boolean;
  isAvailable?: boolean;
  requiresConnection?: string;
  cooldownMinutes?: number;
}

export default function ScheduledJobsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [jobs, setJobs] = useState<ScheduledJob[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingJob, setEditingJob] = useState<ScheduledJob | null>(null);
  const [editForm, setEditForm] = useState({
    name: "",
    prompt: "",
    cronSchedule: "",
    notifyMode: "significant" as "always" | "significant",
  });
  const [isSaving, setIsSaving] = useState(false);
  const [triggeringJobId, setTriggeringJobId] = useState<string | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/request");
    }
  }, [status, router]);

  useEffect(() => {
    if (status === "authenticated") {
      fetchJobs();
    }
  }, [status]);

  const fetchJobs = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/connections/scheduled-jobs`);
      if (response.ok) {
        const data = await response.json();
        setJobs(data.jobs || []);
      }
    } catch (error) {
      console.error("Error fetching jobs:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleJob = async (jobId: string, enabled: boolean) => {
    try {
      await fetch(`/api/connections/scheduled-jobs/${jobId}/toggle`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled }),
      });
      setJobs((prev) =>
        prev.map((j) => (j.id === jobId ? { ...j, enabled } : j)),
      );
    } catch (error) {
      console.error("Error toggling job:", error);
    }
  };

  const handleDeleteJob = async (jobId: string) => {
    if (!confirm("Are you sure you want to delete this scheduled job?")) {
      return;
    }

    try {
      await fetch(`/api/connections/scheduled-jobs/${jobId}`, {
        method: "DELETE",
      });
      setJobs((prev) => prev.filter((j) => j.id !== jobId));
    } catch (error) {
      console.error("Error deleting job:", error);
    }
  };

  const handleTriggerJob = async (jobId: string, jobName: string) => {
    setTriggeringJobId(jobId);
    try {
      const response = await fetch(
        `/api/connections/scheduled-jobs/${jobId}/trigger`,
        {
          method: "POST",
        },
      );
      if (response.ok) {
        // Show brief success feedback - the job will send a message when done
        alert(
          `"${jobName}" triggered! You'll receive the result via iMessage.`,
        );
      } else {
        const data = await response.json();
        alert(`Failed to trigger job: ${data.error || "Unknown error"}`);
      }
    } catch (error) {
      console.error("Error triggering job:", error);
      alert("Failed to trigger job");
    } finally {
      setTriggeringJobId(null);
    }
  };

  const handleEditClick = (job: ScheduledJob) => {
    setEditingJob(job);
    setEditForm({
      name: job.name,
      prompt: job.prompt,
      cronSchedule: job.cronSchedule,
      notifyMode: job.notifyMode,
    });
  };

  const handleSaveEdit = async () => {
    if (!editingJob) return;

    setIsSaving(true);
    try {
      const response = await fetch(
        `/api/connections/scheduled-jobs/${editingJob.id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(editForm),
        },
      );

      if (response.ok) {
        const data = await response.json();
        setJobs((prev) =>
          prev.map((j) =>
            j.id === editingJob.id
              ? {
                  ...j,
                  name: data.job.name,
                  prompt: data.job.prompt,
                  cronSchedule: data.job.cronSchedule,
                  notifyMode: data.job.notifyMode,
                  nextRunAt: data.job.nextRunAt,
                }
              : j,
          ),
        );
        setEditingJob(null);
      }
    } catch (error) {
      console.error("Error saving job:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const formatNextRun = (nextRunAt?: string) => {
    if (!nextRunAt) return "Not scheduled";
    const date = new Date(nextRunAt);
    const now = new Date();
    const diff = date.getTime() - now.getTime();

    if (diff < 0) return "Due now";

    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days > 0) return `In ${days}d`;
    if (hours > 0) return `In ${hours}h`;
    return `In ${minutes}m`;
  };

  const defaultJobs = jobs.filter((j) => j.isDefault);
  const userJobs = jobs.filter((j) => !j.isDefault);

  if (status === "loading" || isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader />
      </div>
    );
  }

  if (!session) {
    return null;
  }

  return (
    <div className="container mx-auto max-w-3xl px-4 py-8 pt-24">
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <Clock className="h-6 w-6" />
          <h1 className="text-2xl font-semibold">Scheduled Jobs</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Manage your proactive notifications and custom scheduled tasks.
        </p>
      </div>

      {/* Default Jobs Section */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-3">
          <Shield className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
            Built-in Notifications
          </h2>
        </div>
        <div className="space-y-2">
          {defaultJobs.map((job) => (
            <div
              key={job.id}
              className={`rounded-lg border p-4 transition-all ${
                !job.enabled ? "opacity-60 bg-muted/30" : ""
              } ${!job.isAvailable ? "opacity-40" : ""}`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-medium">{job.name}</h3>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                      Default
                    </span>
                    {!job.isAvailable && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300 flex items-center gap-1">
                        <Link2Off className="h-3 w-3" />
                        Not connected
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mb-2">
                    {job.prompt}
                  </p>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {job.cronSchedule}
                    </span>
                  </div>
                </div>
                <Switch
                  checked={job.enabled && job.isAvailable !== false}
                  disabled={!job.isAvailable}
                  onCheckedChange={(enabled) =>
                    handleToggleJob(job.id, enabled)
                  }
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* User Jobs Section */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
            Custom Jobs
          </h2>
        </div>

        {userJobs.length === 0 ? (
          <div className="rounded-lg border border-dashed p-6 text-center">
            <Sparkles className="h-8 w-8 mx-auto mb-3 text-muted-foreground/50" />
            <h3 className="text-sm font-medium mb-1">No custom jobs yet</h3>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto">
              Ask Mr. Whiskers to schedule something! Try: &ldquo;Check the news
              every morning for AI dev tools&rdquo;
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {userJobs.map((job) => (
              <div
                key={job.id}
                className={`rounded-lg border p-4 transition-opacity ${
                  !job.enabled ? "opacity-60 bg-muted/30" : ""
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-medium truncate">{job.name}</h3>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full ${
                          job.notifyMode === "always"
                            ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300"
                            : "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"
                        }`}
                      >
                        {job.notifyMode === "always" ? "Always" : "Significant"}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground truncate mb-2">
                      {job.prompt}
                    </p>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {job.cronSchedule}
                      </span>
                      {job.enabled && job.nextRunAt && (
                        <span className="flex items-center gap-1">
                          <Play className="h-3 w-3" />
                          Next: {formatNextRun(job.nextRunAt)}
                        </span>
                      )}
                      {job.lastRunAt && (
                        <span>
                          Last: {new Date(job.lastRunAt).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleTriggerJob(job.id, job.name)}
                      disabled={triggeringJobId === job.id}
                      className="text-muted-foreground hover:text-green-600"
                      title="Run now"
                    >
                      {triggeringJobId === job.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Play className="h-4 w-4" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEditClick(job)}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Switch
                      checked={job.enabled}
                      onCheckedChange={(enabled) =>
                        handleToggleJob(job.id, enabled)
                      }
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteJob(job.id)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Edit Dialog */}
      <Dialog open={!!editingJob} onOpenChange={() => setEditingJob(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Scheduled Job</DialogTitle>
            <DialogDescription>
              Update the settings for this scheduled job.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Name</Label>
              <Input
                id="edit-name"
                value={editForm.name}
                onChange={(e) =>
                  setEditForm((prev) => ({ ...prev, name: e.target.value }))
                }
                placeholder="Job name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-prompt">Prompt</Label>
              <textarea
                id="edit-prompt"
                className="w-full min-h-[80px] px-3 py-2 text-sm border rounded-md bg-background resize-none"
                value={editForm.prompt}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                  setEditForm((prev) => ({ ...prev, prompt: e.target.value }))
                }
                placeholder="What should this job do?"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-cron">Schedule (cron expression)</Label>
              <Input
                id="edit-cron"
                value={editForm.cronSchedule}
                onChange={(e) =>
                  setEditForm((prev) => ({
                    ...prev,
                    cronSchedule: e.target.value,
                  }))
                }
                placeholder="0 9 * * *"
              />
              <p className="text-xs text-muted-foreground">
                e.g., &quot;0 9 * * *&quot; = every day at 9am, &quot;0 * * *
                *&quot; = every hour
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-notify">Notify Mode</Label>
              <select
                id="edit-notify"
                className="w-full px-3 py-2 text-sm border rounded-md bg-background"
                value={editForm.notifyMode}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                  setEditForm((prev) => ({
                    ...prev,
                    notifyMode: e.target.value as "always" | "significant",
                  }))
                }
              >
                <option value="significant">
                  Only when significant results
                </option>
                <option value="always">Always notify</option>
              </select>
            </div>

            <div className="flex gap-2 pt-4">
              <Button
                variant="outline"
                onClick={() => setEditingJob(null)}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSaveEdit}
                disabled={isSaving || !editForm.name || !editForm.prompt}
                className="flex-1"
              >
                {isSaving ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
