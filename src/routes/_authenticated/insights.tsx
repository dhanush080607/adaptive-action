import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
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
import { getInsights, resetWorkspace } from "@/lib/lifeos/api.functions";
import { formatDue, formatMinutesLabel } from "@/lib/lifeos/format";

export const Route = createFileRoute("/_authenticated/insights")({
  head: () => ({
    meta: [
      { title: "Insights — LifeOS" },
      {
        name: "description",
        content: "See how accurate your estimates are, how often plans change, and goal progress.",
      },
      { property: "og:title", content: "Insights — LifeOS" },
      { property: "og:description", content: "Learn how you actually work." },
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
    onError: (e: Error) => toast.error(e.message || "Could not reset your workspace"),
  });

  if (isLoading) return <div className="panel h-64 animate-pulse" />;
  if (!data)
    return (
      <div className="panel p-6">
        <h1 className="text-lg font-semibold">Insights couldn't load</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {error instanceof Error ? error.message : "Something went wrong reading your history."}
        </p>
        <Button className="mt-4" variant="secondary" onClick={() => void refetch()}>
          Try again
        </Button>
      </div>
    );

  const cards = [
    { label: "Completion rate", value: `${data.completion_rate}%` },
    {
      label: "Estimate accuracy",
      value: data.estimate_accuracy == null ? "—" : `${data.estimate_accuracy}%`,
    },
    { label: "Replans", value: String(data.replans) },
    { label: "Feedback given", value: String(data.feedback_count) },
  ];

  return (
    <div className="space-y-6">
      <header>
        <p className="label-caps">Insights</p>
        <h1 className="mt-2 text-3xl font-semibold">How you actually work</h1>
      </header>

      <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="panel p-5">
            <dt className="label-caps">{c.label}</dt>
            <dd className="mt-2 font-mono text-3xl">{c.value}</dd>
          </div>
        ))}
      </dl>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="panel p-5">
          <h2 className="text-lg font-semibold">Goal progress</h2>
          <ul className="mt-4 space-y-3">
            {data.goals.map((g) => (
              <li key={g.id}>
                <div className="flex items-center justify-between text-sm">
                  <span className="truncate">{g.title}</span>
                  <span className="font-mono text-xs text-muted-foreground">{g.progress}%</span>
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{ width: `${Math.min(100, g.progress)}%` }}
                  />
                </div>
              </li>
            ))}
            {data.goals.length === 0 && (
              <li className="text-sm text-muted-foreground">No goals yet.</li>
            )}
          </ul>
        </section>

        <section className="panel p-5">
          <h2 className="text-lg font-semibold">Estimated vs actual</h2>
          <ul className="mt-4 space-y-2">
            {data.estimated_vs_actual.map((t) => (
              <li
                key={t.title}
                className="flex items-center justify-between rounded-lg border border-border/60 p-3 text-sm"
              >
                <span className="truncate">{t.title}</span>
                <span className="ml-3 shrink-0 font-mono text-xs text-muted-foreground">
                  {formatMinutesLabel(t.estimated)} → {formatMinutesLabel(t.actual)}
                </span>
              </li>
            ))}
            {data.estimated_vs_actual.length === 0 && (
              <li className="text-sm text-muted-foreground">
                Give feedback with actual minutes to unlock this.
              </li>
            )}
          </ul>
        </section>

        <section className="panel p-5">
          <h2 className="text-lg font-semibold">Upcoming deadlines</h2>
          <ul className="mt-4 space-y-2">
            {data.upcoming.map((d) => (
              <li key={d.id} className="flex items-center justify-between text-sm">
                <span className="truncate">{d.title}</span>
                <span className="ml-3 shrink-0 text-xs text-muted-foreground">
                  {formatDue(d.due_at)}
                </span>
              </li>
            ))}
            {data.upcoming.length === 0 && (
              <li className="text-sm text-muted-foreground">Nothing on the horizon.</li>
            )}
          </ul>
        </section>

        <section className="panel p-5">
          <h2 className="text-lg font-semibold">Recent activity</h2>
          <ul className="mt-4 space-y-1.5 font-mono text-xs text-muted-foreground">
            {data.activity.map((a, i) => (
              <li key={`${a.created_at}-${i}`}>
                {new Date(a.created_at).toLocaleString()} — {a.event_type}
              </li>
            ))}
            {data.activity.length === 0 && <li>No activity recorded yet.</li>}
          </ul>
        </section>
      </div>

      <section className="panel border-destructive/40 p-5">
        <h2 className="text-lg font-semibold">Danger zone</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Delete every goal, task, deadline, plan and piece of feedback in your workspace. This
          cannot be undone.
        </p>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" className="mt-4" disabled={reset.isPending}>
              <Trash2 className="mr-1.5 h-4 w-4" />
              {reset.isPending ? "Resetting…" : "Reset workspace"}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Reset your workspace?</AlertDialogTitle>
              <AlertDialogDescription>
                Everything LifeOS has learned about your goals, tasks and plans will be permanently
                deleted. Your account stays intact.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={() => reset.mutate()}>
                Yes, delete everything
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </section>
    </div>
  );
}
