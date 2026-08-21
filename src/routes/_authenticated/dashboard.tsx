import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { CalendarClock, RefreshCw, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AmbientBackground, type AmbientState } from "@/components/lifeos/AmbientBackground";
import { NextActionCard } from "@/components/lifeos/NextActionCard";
import { PlanTimeline, type TimelineItem } from "@/components/lifeos/PlanTimeline";
import { FeedbackDialog } from "@/components/lifeos/FeedbackDialog";
import { PriorityBadge } from "@/components/lifeos/PriorityBadge";
import { getDashboard, replan, submitFeedback, updateTask } from "@/lib/lifeos/api.functions";
import { formatDue, formatMinutesLabel, greeting, STATUS_LABELS } from "@/lib/lifeos/format";
import type { FeedbackKind } from "@/lib/lifeos/types";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — LifeOS" },
      {
        name: "description",
        content: "Your next best action, live plan and priority queue in one place.",
      },
      { property: "og:title", content: "Dashboard — LifeOS" },
      { property: "og:description", content: "One clear next action, always up to date." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const queryClient = useQueryClient();
  const dashboardFn = useServerFn(getDashboard);
  const replanFn = useServerFn(replan);
  const feedbackFn = useServerFn(submitFeedback);
  const updateTaskFn = useServerFn(updateTask);

  const [aiState, setAiState] = useState<AmbientState>("IDLE");
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [previousItems, setPreviousItems] = useState<TimelineItem[] | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => dashboardFn(),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["dashboard"] });

  const replanMutation = useMutation({
    mutationFn: async () => {
      setAiState("REPLANNING");
      return replanFn({ data: {} });
    },
    onSuccess: async () => {
      toast.success("Plan rebuilt around your remaining time");
      await invalidate();
    },
    onError: (e: Error) => toast.error(e.message || "Could not replan"),
    onSettled: () => setAiState("IDLE"),
  });

  const feedbackMutation = useMutation({
    mutationFn: async (payload: {
      kind: FeedbackKind;
      note?: string;
      actual_minutes?: number;
      progress?: number;
    }) => {
      const taskId = data?.next_action?.task_id;
      if (!taskId) throw new Error("No active task");
      setAiState("REPLANNING");
      setPreviousItems((data?.plan_items ?? []) as TimelineItem[]);
      return feedbackFn({ data: { task_id: taskId, ...payload } });
    },
    onSuccess: async (result) => {
      setFeedbackOpen(false);
      toast.success(
        result.replanned ? "Plan adapted to what actually happened" : result.evaluation.outcome,
      );
      await invalidate();
      setTimeout(() => setPreviousItems(null), 600);
    },
    onError: (e: Error) => toast.error(e.message || "Could not save feedback"),
    onSettled: () => setAiState("IDLE"),
  });

  const startMutation = useMutation({
    mutationFn: async (taskId: string) =>
      updateTaskFn({ data: { id: taskId, patch: { status: "in_progress" } } }),
    onSuccess: async () => {
      toast.success("Focus session started");
      await invalidate();
    },
  });

  const next = data?.next_action ?? null;
  const items = (previousItems ?? data?.plan_items ?? []) as TimelineItem[];
  const openTasks = (data?.tasks ?? []).filter((t) =>
    ["pending", "in_progress", "delayed", "blocked"].includes(t.status),
  );

  return (
    <>
      <AmbientBackground state={aiState} density="subtle" />

      <div className="relative z-10 space-y-8">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="label-caps">{greeting()}</p>
            <h1 className="mt-1 text-3xl font-semibold">
              {data?.profile?.name ? `Ready, ${data.profile.name}?` : "Your action center"}
            </h1>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" asChild>
              <Link to="/capture">Capture information</Link>
            </Button>
            <Button
              variant="outline"
              onClick={() => replanMutation.mutate()}
              disabled={replanMutation.isPending}
            >
              <RefreshCw
                className={`mr-1.5 h-4 w-4 ${replanMutation.isPending ? "animate-spin" : ""}`}
              />
              Replan
            </Button>
          </div>
        </header>

        {isLoading ? (
          <div className="panel h-52 animate-pulse" />
        ) : (
          <NextActionCard
            action={next}
            busy={startMutation.isPending || feedbackMutation.isPending}
            onStart={() => next && startMutation.mutate(next.task_id)}
            onFeedback={() => setFeedbackOpen(true)}
          />
        )}

        <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
          <section className="panel p-5 sm:p-6">
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-lg font-semibold">
                <CalendarClock className="h-4 w-4 text-primary" /> Today's plan
              </h2>
              <Link to="/plan" className="text-xs text-primary hover:underline">
                Full plan
              </Link>
            </div>
            <div className="mt-4">
              <PlanTimeline items={items} highlightTaskId={next?.task_id ?? null} />
            </div>
          </section>

          <div className="space-y-6">
            <section className="panel p-5 sm:p-6">
              <h2 className="text-lg font-semibold">Signals</h2>
              <dl className="mt-4 grid grid-cols-2 gap-3">
                {[
                  { label: "Open", value: data?.stats.open ?? 0 },
                  { label: "Completed", value: data?.stats.completed ?? 0 },
                  { label: "Delayed", value: data?.stats.delayed ?? 0 },
                  { label: "Blocked", value: data?.stats.blocked ?? 0 },
                ].map((s) => (
                  <div key={s.label} className="rounded-lg border border-border/60 p-3">
                    <dt className="label-caps">{s.label}</dt>
                    <dd className="mt-1 font-mono text-2xl">{s.value}</dd>
                  </div>
                ))}
              </dl>
            </section>

            <section className="panel p-5 sm:p-6">
              <h2 className="flex items-center gap-2 text-lg font-semibold">
                <Target className="h-4 w-4 text-primary" /> Priority queue
              </h2>
              <ul className="mt-4 space-y-2">
                {openTasks.slice(0, 6).map((t) => (
                  <li key={t.id}>
                    <Link
                      to="/tasks/$id"
                      params={{ id: t.id }}
                      className="flex items-center gap-3 rounded-lg border border-border/60 p-3 transition-colors hover:border-primary/50"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{t.title}</span>
                        <span className="block text-xs text-muted-foreground">
                          {STATUS_LABELS[t.status] ?? t.status} ·{" "}
                          {formatMinutesLabel(t.estimated_minutes)} · {formatDue(t.deadline)}
                        </span>
                      </span>
                      <PriorityBadge level={t.priority_level} />
                    </Link>
                  </li>
                ))}
                {openTasks.length === 0 && (
                  <li className="text-sm text-muted-foreground">
                    Nothing open. Capture new information to fill your queue.
                  </li>
                )}
              </ul>
            </section>
          </div>
        </div>
      </div>

      {next && (
        <FeedbackDialog
          open={feedbackOpen}
          onOpenChange={setFeedbackOpen}
          taskTitle={next.task}
          estimatedMinutes={next.estimated_minutes}
          submitting={feedbackMutation.isPending}
          onSubmit={(payload) => feedbackMutation.mutate(payload)}
        />
      )}
    </>
  );
}
