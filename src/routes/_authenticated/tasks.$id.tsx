import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PriorityBadge } from "@/components/lifeos/PriorityBadge";
import { FeedbackDialog } from "@/components/lifeos/FeedbackDialog";
import { getTaskDetail, submitFeedback, updateTask } from "@/lib/lifeos/api.functions";
import { formatDue, formatMinutesLabel, STATUS_LABELS } from "@/lib/lifeos/format";
import type { FeedbackKind } from "@/lib/lifeos/types";

export const Route = createFileRoute("/_authenticated/tasks/$id")({
  head: () => ({
    meta: [
      { title: "Task details — LifeOS" },
      {
        name: "description",
        content: "See exactly why a task is prioritized, what it blocks and what it depends on.",
      },
      { property: "og:title", content: "Task details — LifeOS" },
      { property: "og:description", content: "Transparent priority reasoning per task." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: TaskDetail,
});

function TaskDetail() {
  const { id } = Route.useParams();
  const queryClient = useQueryClient();
  const detailFn = useServerFn(getTaskDetail);
  const feedbackFn = useServerFn(submitFeedback);
  const updateFn = useServerFn(updateTask);
  const [open, setOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["task", id],
    queryFn: () => detailFn({ data: { id } }),
  });

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: ["task", id] });
    await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
  };

  const feedback = useMutation({
    mutationFn: async (payload: {
      kind: FeedbackKind;
      note?: string;
      actual_minutes?: number;
      progress?: number;
    }) => feedbackFn({ data: { task_id: id, ...payload } }),
    onSuccess: async (result) => {
      setOpen(false);
      toast.success(result.replanned ? "Plan adapted" : result.evaluation.outcome);
      await invalidate();
    },
    onError: (e: Error) => toast.error(e.message || "Could not save feedback"),
  });

  const complete = useMutation({
    mutationFn: async () => updateFn({ data: { id, patch: { status: "completed" } } }),
    onSuccess: async () => {
      toast.success("Marked complete");
      await invalidate();
    },
  });

  // Full-screen loading animation state
  if (isLoading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#020508] p-6">
        <div className="panel h-full w-full animate-pulse" />
      </div>
    );
  }

  // Task not found state
  if (!data) {
    return (
      <div className="min-h-[calc(100vh-120px)] bg-[#020508] text-foreground">
        <div className="panel p-8 text-center">
          <h1 className="text-2xl font-semibold">Task not found</h1>
          <Button className="mt-6" asChild>
            <Link to="/dashboard">Back to dashboard</Link>
          </Button>
        </div>
      </div>
    );
  }

  const { task, priority, dependencies, blocking, goal } = data;

  return (
    <div className="min-h-[calc(100vh-120px)] space-y-6 bg-[#020508] text-foreground">
      <header className="panel p-6">
        <div className="flex flex-wrap items-center gap-3">
          <PriorityBadge level={task.priority} />
          <span className="text-xs text-muted-foreground">
            {STATUS_LABELS[task.status] ?? task.status} ·{" "}
            {formatMinutesLabel(task.estimated_minutes)} · {formatDue(task.deadline)}
          </span>
          <span className="ml-auto font-mono text-xs text-muted-foreground">
            score {priority.score}
          </span>
        </div>
        <h1 className="mt-3 text-3xl font-semibold">{task.title}</h1>
        {task.description && (
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{task.description}</p>
        )}
        {goal && <p className="mt-2 text-xs text-muted-foreground">Goal: {goal.title}</p>}
        <div className="mt-5 flex flex-wrap gap-2">
          <Button onClick={() => setOpen(true)}>Give feedback</Button>
          <Button
            variant="secondary"
            onClick={() => complete.mutate()}
            disabled={complete.isPending || task.status === "completed"}
          >
            Mark complete
          </Button>
          <Button variant="ghost" asChild>
            <Link to="/dashboard">Back</Link>
          </Button>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="panel p-5">
          <h2 className="text-lg font-semibold">Why this priority</h2>
          <ul className="mt-3 space-y-2">
            {priority.factors.map((f) => (
              <li key={f} className="flex gap-2 text-sm text-muted-foreground">
                <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-primary" />
                {f}
              </li>
            ))}
            {priority.factors.length === 0 && (
              <li className="text-sm text-muted-foreground">No strong priority signals yet.</li>
            )}
          </ul>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary"
              style={{ width: `${Math.min(100, priority.score)}%` }}
            />
          </div>
          <p className="mt-2 font-mono text-xs text-muted-foreground">
            progress {task.progress}% · importance {task.importance} · urgency {task.urgency}
          </p>
        </section>

        <section className="panel p-5">
          <h2 className="text-lg font-semibold">Dependencies</h2>
          <p className="label-caps mt-3">Waiting on</p>
          <ul className="mt-2 space-y-1.5 text-sm">
            {dependencies.map((d) => (
              <li key={d.id}>
                <Link to="/tasks/$id" params={{ id: d.id }} className="hover:text-primary">
                  {d.title}
                </Link>{" "}
                <span className="text-xs text-muted-foreground">
                  ({STATUS_LABELS[d.status] ?? d.status})
                </span>
              </li>
            ))}
            {dependencies.length === 0 && (
              <li className="text-sm text-muted-foreground">Nothing.</li>
            )}
          </ul>
          <p className="label-caps mt-4">Blocks</p>
          <ul className="mt-2 space-y-1.5 text-sm">
            {blocking.map((b) => (
              <li key={b.id}>
                <Link to="/tasks/$id" params={{ id: b.id }} className="hover:text-primary">
                  {b.title}
                </Link>
              </li>
            ))}
            {blocking.length === 0 && <li className="text-sm text-muted-foreground">Nothing.</li>}
          </ul>
        </section>
      </div>

      <FeedbackDialog
        open={open}
        onOpenChange={setOpen}
        taskTitle={task.title}
        estimatedMinutes={task.estimated_minutes}
        submitting={feedback.isPending}
        onSubmit={(payload) => feedback.mutate(payload)}
      />
    </div>
  );
}
