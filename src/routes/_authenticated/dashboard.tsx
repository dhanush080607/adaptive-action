import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { CalendarClock, RefreshCw, Target, PlusCircle, Activity, ChevronRight, CheckCircle2, Clock, AlertCircle } from "lucide-react";
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

  const stats = [
    { label: "Open", value: data?.stats.open ?? 0, icon: Clock, color: "text-primary" },
    { label: "Completed", value: data?.stats.completed ?? 0, icon: CheckCircle2, color: "text-success" },
    { label: "Delayed", value: data?.stats.delayed ?? 0, icon: AlertCircle, color: "text-warning" },
    { label: "Blocked", value: data?.stats.blocked ?? 0, icon: AlertCircle, color: "text-destructive" },
  ];

  return (
    <>
      <AmbientBackground state={aiState} density="subtle" />

      <div className="relative z-10 space-y-8 fade-in">
        {/* Header Bar */}
        <header className="flex flex-wrap items-end justify-between gap-4 border-b border-border/40 pb-5">
          <div>
            <span className="label-caps">{greeting()}</span>
            <h1 className="mt-1 text-3xl font-semibold text-gradient tracking-tight">
              {data?.profile?.name ? `Ready, ${data.profile.name}?` : "Your Action Center"}
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="secondary"
              asChild
              className="border border-border/60 bg-surface hover:bg-surface-elevated hover:border-primary/40 transition-all shadow-sm"
            >
              <Link to="/capture" className="flex items-center gap-2">
                <PlusCircle className="h-4 w-4 text-primary" />
                <span>Capture Task</span>
              </Link>
            </Button>
            <Button
              variant="outline"
              onClick={() => replanMutation.mutate()}
              disabled={replanMutation.isPending}
              className="border-primary/30 bg-primary/5 hover:bg-primary/10 text-primary transition-all shadow-glow-cyan/20"
            >
              <RefreshCw
                className={`mr-1.5 h-4 w-4 ${replanMutation.isPending ? "animate-spin" : ""}`}
              />
              Replan
            </Button>
          </div>
        </header>

        {/* Hero Next Action Section */}
        {isLoading ? (
          <div className="panel h-56 animate-pulse bg-surface/50 border-border/40 rounded-2xl" />
        ) : (
          <NextActionCard
            action={next}
            busy={startMutation.isPending || feedbackMutation.isPending}
            onStart={() => next && startMutation.mutate(next.task_id)}
            onFeedback={() => setFeedbackOpen(true)}
          />
        )}

        {/* Dynamic Grid Layout */}
        <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
          {/* Main Column: Plan Timeline */}
          <section className="panel panel-hover p-6 rounded-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-border/30 pb-3">
              <h2 className="flex items-center gap-2 text-base font-medium tracking-tight text-foreground">
                <CalendarClock className="h-4.5 w-4.5 text-primary" /> Today's Focus Schedule
              </h2>
              <Link
                to="/plan"
                className="group flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors"
              >
                <span>Full Timeline</span>
                <ChevronRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
              </Link>
            </div>
            <div className="pt-2">
              <PlanTimeline items={items} highlightTaskId={next?.task_id ?? null} />
            </div>
          </section>

          {/* Side Column: Telemetry & Priority Queue */}
          <div className="space-y-6">
            {/* System Signals Telemetry */}
            <section className="panel panel-hover p-6 rounded-2xl">
              <div className="flex items-center gap-2 text-base font-medium border-b border-border/30 pb-3">
                <Activity className="h-4.5 w-4.5 text-primary" /> Signals
              </div>
              <dl className="mt-4 grid grid-cols-2 gap-3">
                {stats.map((s) => {
                  const Icon = s.icon;
                  return (
                    <div
                      key={s.label}
                      className="rounded-xl border border-border/50 bg-background/40 p-3.5 backdrop-blur-md transition-all hover:border-border"
                    >
                      <dt className="flex items-center justify-between label-caps text-xs">
                        <span>{s.label}</span>
                        <Icon className={`h-3.5 w-3.5 ${s.color}`} />
                      </dt>
                      <dd className="mt-2 font-mono text-2xl font-semibold tracking-tight text-foreground">
                        {s.value}
                      </dd>
                    </div>
                  );
                })}
              </dl>
            </section>

            {/* Priority Queue */}
            <section className="panel panel-hover p-6 rounded-2xl">
              <div className="flex items-center justify-between border-b border-border/30 pb-3">
                <h2 className="flex items-center gap-2 text-base font-medium text-foreground">
                  <Target className="h-4.5 w-4.5 text-primary" /> Priority Queue
                </h2>
                <span className="font-mono text-xs text-muted-foreground">
                  {openTasks.length} pending
                </span>
              </div>
              <ul className="mt-4 space-y-2.5">
                {openTasks.slice(0, 6).map((t) => (
                  <li key={t.id}>
                    <Link
                      to="/tasks/$id"
                      params={{ id: t.id }}
                      className="group flex items-center justify-between gap-3 rounded-xl border border-border/50 bg-background/30 p-3 transition-all hover:border-primary/40 hover:bg-surface-elevated/60"
                    >
                      <span className="min-w-0 flex-1 space-y-0.5">
                        <span className="block truncate text-sm font-medium text-foreground/90 group-hover:text-primary transition-colors">
                          {t.title}
                        </span>
                        <span className="block text-xs font-mono text-muted-foreground">
                          {STATUS_LABELS[t.status] ?? t.status} ·{" "}
                          {formatMinutesLabel(t.estimated_minutes)} · {formatDue(t.deadline)}
                        </span>
                      </span>
                      <PriorityBadge level={t.priority} />
                    </Link>
                  </li>
                ))}
                {openTasks.length === 0 && (
                  <li className="py-6 text-center text-xs text-muted-foreground border border-dashed border-border/40 rounded-xl">
                    Queue clear. Capture new information to populate your workflow.
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