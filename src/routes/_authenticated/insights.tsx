import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Activity,
  BarChart3,
  CheckCircle2,
  Clock3,
  Gauge,
  RotateCcw,
  Target,
  Trash2,
  TrendingUp,
  AlertTriangle,
  CalendarClock,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

import { AmbientBackground } from "@/components/lifeos/AmbientBackground";
import { getInsights, resetWorkspace } from "@/lib/lifeos/api.functions";
import { formatDue, formatMinutesLabel } from "@/lib/lifeos/format";

export const Route = createFileRoute("/_authenticated/insights")({
  head: () => ({
    meta: [
      { title: "Insights — LifeOS" },
      {
        name: "description",
        content:
          "See how accurate your estimates are, how often plans change, and goal progress.",
      },
      { property: "og:title", content: "Insights — LifeOS" },
      {
        property: "og:description",
        content: "Learn how you actually work.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Insights,
});

function Insights() {
  const insightsFn = useServerFn(getInsights);
  const resetFn = useServerFn(resetWorkspace);
  const queryClient = useQueryClient();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["insights"],
    queryFn: () => insightsFn(),
  });

  const reset = useMutation({
    mutationFn: () => resetFn({ data: undefined }),
    onSuccess: async () => {
      toast.success("Workspace reset");
      await queryClient.invalidateQueries();
    },
    onError: (e: Error) =>
      toast.error(e.message || "Could not reset your workspace"),
  });

  if (isLoading) {
    return (
      <>
        <AmbientBackground state="IDLE" density="subtle" />

        <div className="relative z-10 space-y-6">
          <div className="h-28 animate-pulse rounded-3xl border border-border/30 bg-surface/40 backdrop-blur-xl" />

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="h-32 animate-pulse rounded-2xl border border-border/30 bg-surface/40 backdrop-blur-xl"
              />
            ))}
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="h-64 animate-pulse rounded-2xl border border-border/30 bg-surface/40 backdrop-blur-xl"
              />
            ))}
          </div>
        </div>
      </>
    );
  }

  if (!data) {
    return (
      <>
        <AmbientBackground state="IDLE" density="subtle" />

        <div className="relative z-10 flex min-h-[60vh] items-center justify-center">
          <div className="relative w-full max-w-lg overflow-hidden rounded-3xl border border-border/50 bg-surface/70 p-8 text-center shadow-2xl backdrop-blur-2xl">
            <div className="pointer-events-none absolute -left-20 -top-20 h-40 w-40 rounded-full bg-primary/10 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-20 -right-20 h-40 w-40 rounded-full bg-primary/5 blur-3xl" />

            <div className="relative">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-border/50 bg-background/50">
                <AlertTriangle className="h-6 w-6 text-warning" />
              </div>

              <h1 className="mt-5 text-xl font-semibold">
                Insights couldn't load
              </h1>

              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {error instanceof Error
                  ? error.message
                  : "Something went wrong reading your history."}
              </p>

              <Button
                className="mt-6 border border-primary/30 bg-primary/10 text-primary hover:bg-primary/20"
                variant="outline"
                onClick={() => void refetch()}
              >
                <RotateCcw className="mr-2 h-4 w-4" />
                Try again
              </Button>
            </div>
          </div>
        </div>
      </>
    );
  }

  const cards = [
    {
      label: "Completion rate",
      value: `${data.completion_rate}%`,
      icon: CheckCircle2,
      description: "Tasks completed",
    },
    {
      label: "Estimate accuracy",
      value:
        data.estimate_accuracy == null
          ? "—"
          : `${data.estimate_accuracy}%`,
      icon: Gauge,
      description: "Prediction accuracy",
    },
    {
      label: "Replans",
      value: String(data.replans),
      icon: RotateCcw,
      description: "Plans adapted",
    },
    {
      label: "Feedback given",
      value: String(data.feedback_count),
      icon: Activity,
      description: "Learning signals",
    },
  ];

  return (
    <>
      <AmbientBackground state="IDLE" density="subtle" />

      <div className="relative z-10 space-y-7 fade-in">
        {/* ========================================= */}
        {/* HEADER */}
        {/* ========================================= */}

        <header className="relative overflow-hidden rounded-3xl border border-border/40 bg-surface/50 px-6 py-7 shadow-2xl backdrop-blur-xl sm:px-8">
          {/* Black-hole glow */}
          <div className="pointer-events-none absolute -right-24 -top-32 h-72 w-72 rounded-full bg-primary/10 blur-[100px]" />
          <div className="pointer-events-none absolute -bottom-32 -left-24 h-72 w-72 rounded-full bg-primary/5 blur-[100px]" />

          {/* Orbital ring */}
          <div className="pointer-events-none absolute right-8 top-1/2 hidden h-40 w-40 -translate-y-1/2 rounded-full border border-primary/10 md:block" />
          <div className="pointer-events-none absolute right-16 top-1/2 hidden h-24 w-24 -translate-y-1/2 rounded-full border border-primary/10 md:block" />

          <div className="relative">
            <div className="flex items-center gap-2 text-primary">
              <BarChart3 className="h-4 w-4" />
              <p className="label-caps">System intelligence</p>
            </div>

            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-gradient sm:text-4xl">
              How you actually work
            </h1>

            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              LifeOS learns from your completed work, feedback, estimates,
              replans, and deadlines to understand your execution patterns.
            </p>
          </div>
        </header>

        {/* ========================================= */}
        {/* METRIC CARDS */}
        {/* ========================================= */}

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {cards.map((card) => {
            const Icon = card.icon;

            return (
              <div
                key={card.label}
                className="group relative overflow-hidden rounded-2xl border border-border/40 bg-surface/55 p-5 shadow-xl backdrop-blur-xl transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/30 hover:bg-surface/70"
              >
                {/* Glow */}
                <div className="pointer-events-none absolute -right-10 -top-10 h-24 w-24 rounded-full bg-primary/10 blur-2xl opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

                <div className="relative">
                  <div className="flex items-center justify-between">
                    <span className="label-caps">{card.label}</span>

                    <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-border/40 bg-background/50">
                      <Icon className="h-4 w-4 text-primary" />
                    </div>
                  </div>

                  <dd className="mt-4 font-mono text-3xl font-semibold tracking-tight text-foreground">
                    {card.value}
                  </dd>

                  <p className="mt-1 text-xs text-muted-foreground">
                    {card.description}
                  </p>
                </div>
              </div>
            );
          })}
        </section>

        {/* ========================================= */}
        {/* MAIN ANALYTICS GRID */}
        {/* ========================================= */}

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Goal Progress */}
          <section className="group relative overflow-hidden rounded-2xl border border-border/40 bg-surface/55 p-6 shadow-xl backdrop-blur-xl transition-all duration-300 hover:border-primary/25">
            <div className="pointer-events-none absolute -right-24 -top-24 h-48 w-48 rounded-full bg-primary/5 blur-3xl" />

            <div className="relative">
              <div className="flex items-center justify-between border-b border-border/30 pb-4">
                <div>
                  <p className="label-caps text-primary">Progress engine</p>
                  <h2 className="mt-1 text-lg font-semibold">
                    Goal progress
                  </h2>
                </div>

                <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-border/40 bg-background/50">
                  <Target className="h-4 w-4 text-primary" />
                </div>
              </div>

              <ul className="mt-5 space-y-5">
                {data.goals.map((g) => (
                  <li key={g.id}>
                    <div className="flex items-center justify-between gap-4 text-sm">
                      <span className="min-w-0 truncate font-medium">
                        {g.title}
                      </span>

                      <span className="shrink-0 font-mono text-xs text-primary">
                        {g.progress}%
                      </span>
                    </div>

                    <div className="relative mt-2 h-2 overflow-hidden rounded-full bg-background/70">
                      <div
                        className="h-full rounded-full bg-primary shadow-[0_0_12px_hsl(var(--primary)/0.5)] transition-all duration-700"
                        style={{
                          width: `${Math.min(100, g.progress)}%`,
                        }}
                      />
                    </div>
                  </li>
                ))}

                {data.goals.length === 0 && (
                  <li className="rounded-xl border border-dashed border-border/40 bg-background/20 p-6 text-center text-sm text-muted-foreground">
                    No goals yet.
                  </li>
                )}
              </ul>
            </div>
          </section>

          {/* Estimated vs Actual */}
          <section className="group relative overflow-hidden rounded-2xl border border-border/40 bg-surface/55 p-6 shadow-xl backdrop-blur-xl transition-all duration-300 hover:border-primary/25">
            <div className="pointer-events-none absolute -left-24 -top-24 h-48 w-48 rounded-full bg-primary/5 blur-3xl" />

            <div className="relative">
              <div className="flex items-center justify-between border-b border-border/30 pb-4">
                <div>
                  <p className="label-caps text-primary">Execution data</p>
                  <h2 className="mt-1 text-lg font-semibold">
                    Estimated vs actual
                  </h2>
                </div>

                <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-border/40 bg-background/50">
                  <Clock3 className="h-4 w-4 text-primary" />
                </div>
              </div>

              <ul className="mt-5 space-y-2.5">
                {data.estimated_vs_actual.map((t) => (
                  <li
                    key={t.title}
                    className="group/item flex items-center justify-between gap-3 rounded-xl border border-border/40 bg-background/25 p-3.5 transition-all hover:border-primary/25 hover:bg-background/40"
                  >
                    <span className="min-w-0 truncate text-sm font-medium">
                      {t.title}
                    </span>

                    <span className="shrink-0 rounded-lg border border-border/30 bg-background/40 px-2.5 py-1 font-mono text-xs text-muted-foreground">
                      {formatMinutesLabel(t.estimated)}
                      <span className="mx-1.5 text-primary">→</span>
                      {formatMinutesLabel(t.actual)}
                    </span>
                  </li>
                ))}

                {data.estimated_vs_actual.length === 0 && (
                  <li className="rounded-xl border border-dashed border-border/40 bg-background/20 p-6 text-center text-sm text-muted-foreground">
                    Give feedback with actual minutes to unlock this.
                  </li>
                )}
              </ul>
            </div>
          </section>

          {/* Upcoming Deadlines */}
          <section className="group relative overflow-hidden rounded-2xl border border-border/40 bg-surface/55 p-6 shadow-xl backdrop-blur-xl transition-all duration-300 hover:border-primary/25">
            <div className="pointer-events-none absolute -bottom-24 -right-24 h-48 w-48 rounded-full bg-primary/5 blur-3xl" />

            <div className="relative">
              <div className="flex items-center justify-between border-b border-border/30 pb-4">
                <div>
                  <p className="label-caps text-primary">Time pressure</p>
                  <h2 className="mt-1 text-lg font-semibold">
                    Upcoming deadlines
                  </h2>
                </div>

                <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-border/40 bg-background/50">
                  <CalendarClock className="h-4 w-4 text-primary" />
                </div>
              </div>

              <ul className="mt-5 space-y-2">
                {data.upcoming.map((d) => (
                  <li
                    key={d.id}
                    className="flex items-center justify-between gap-4 rounded-xl border border-border/30 bg-background/20 p-3 transition-all hover:border-primary/20 hover:bg-background/30"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border/30 bg-background/40">
                        <TrendingUp className="h-3.5 w-3.5 text-primary" />
                      </div>

                      <span className="truncate text-sm font-medium">
                        {d.title}
                      </span>
                    </div>

                    <span className="shrink-0 font-mono text-xs text-muted-foreground">
                      {formatDue(d.due_at)}
                    </span>
                  </li>
                ))}

                {data.upcoming.length === 0 && (
                  <li className="rounded-xl border border-dashed border-border/40 bg-background/20 p-6 text-center text-sm text-muted-foreground">
                    Nothing on the horizon.
                  </li>
                )}
              </ul>
            </div>
          </section>

          {/* Recent Activity */}
          <section className="group relative overflow-hidden rounded-2xl border border-border/40 bg-surface/55 p-6 shadow-xl backdrop-blur-xl transition-all duration-300 hover:border-primary/25">
            <div className="pointer-events-none absolute -bottom-24 -left-24 h-48 w-48 rounded-full bg-primary/5 blur-3xl" />

            <div className="relative">
              <div className="flex items-center justify-between border-b border-border/30 pb-4">
                <div>
                  <p className="label-caps text-primary">System telemetry</p>
                  <h2 className="mt-1 text-lg font-semibold">
                    Recent activity
                  </h2>
                </div>

                <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-border/40 bg-background/50">
                  <Activity className="h-4 w-4 text-primary" />
                </div>
              </div>

              <ul className="mt-5 max-h-64 space-y-2 overflow-y-auto pr-1 font-mono text-xs text-muted-foreground">
                {data.activity.map((a, i) => (
                  <li
                    key={`${a.created_at}-${i}`}
                    className="rounded-lg border border-border/30 bg-background/20 px-3 py-2.5 transition-colors hover:border-border/50 hover:bg-background/30"
                  >
                    <span className="text-primary/80">
                      {new Date(a.created_at).toLocaleString()}
                    </span>

                    <span className="mx-2 text-border">—</span>

                    <span>{a.event_type}</span>
                  </li>
                ))}

                {data.activity.length === 0 && (
                  <li className="rounded-xl border border-dashed border-border/40 bg-background/20 p-6 text-center">
                    No activity recorded yet.
                  </li>
                )}
              </ul>
            </div>
          </section>
        </div>

        {/* ========================================= */}
        {/* DANGER ZONE */}
        {/* ========================================= */}

        <section className="relative overflow-hidden rounded-2xl border border-destructive/25 bg-destructive/[0.03] p-6 shadow-xl backdrop-blur-xl">
          <div className="pointer-events-none absolute -right-20 -top-20 h-40 w-40 rounded-full bg-destructive/5 blur-3xl" />

          <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <Trash2 className="h-4 w-4 text-destructive" />
                <p className="label-caps text-destructive">
                  Danger zone
                </p>
              </div>

              <h2 className="mt-2 text-lg font-semibold">
                Reset workspace
              </h2>

              <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                Delete every goal, task, deadline, plan and piece of feedback
                in your workspace. This cannot be undone. Your account stays
                intact.
              </p>
            </div>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="destructive"
                  disabled={reset.isPending}
                  className="shrink-0 shadow-lg shadow-destructive/10"
                >
                  <Trash2 className="mr-1.5 h-4 w-4" />
                  {reset.isPending
                    ? "Resetting…"
                    : "Reset workspace"}
                </Button>
              </AlertDialogTrigger>

              <AlertDialogContent className="border-border/50 bg-surface/95 backdrop-blur-xl">
                <AlertDialogHeader>
                  <AlertDialogTitle>
                    Reset your workspace?
                  </AlertDialogTitle>

                  <AlertDialogDescription>
                    Everything LifeOS has learned about your goals, tasks and
                    plans will be permanently deleted. Your account stays
                    intact.
                  </AlertDialogDescription>
                </AlertDialogHeader>

                <AlertDialogFooter>
                  <AlertDialogCancel>
                    Cancel
                  </AlertDialogCancel>

                  <AlertDialogAction
                    onClick={() => reset.mutate()}
                  >
                    Yes, delete everything
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </section>
      </div>
    </>
  );
}