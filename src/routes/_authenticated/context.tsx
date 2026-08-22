import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AmbientBackground, type AmbientState } from "@/components/lifeos/AmbientBackground";
import { confirmContext, getLatestContext } from "@/lib/lifeos/api.functions";
import { contextExtractionSchema, type ContextExtraction } from "@/lib/lifeos/types";
import { formatMinutesLabel } from "@/lib/lifeos/format";

export const Route = createFileRoute("/_authenticated/context")({
  head: () => ({
    meta: [
      { title: "Review context — LifeOS" },
      {
        name: "description",
        content: "Check what LifeOS understood from your input before it builds your plan.",
      },
      { property: "og:title", content: "Review context — LifeOS" },
      { property: "og:description", content: "Transparent AI understanding you can correct." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ContextReview,
});

const CERTAINTY_STYLE: Record<string, string> = {
  explicit: "text-[color:var(--color-success)]",
  inferred: "text-[color:var(--color-warning)]",
  uncertain: "text-destructive",
};

function ContextReview() {
  const navigate = useNavigate();
  const latestFn = useServerFn(getLatestContext);
  const confirmFn = useServerFn(confirmContext);
  const [minutes, setMinutes] = useState("180");
  const [aiState, setAiState] = useState<AmbientState>("IDLE");

  const { data, isLoading } = useQuery({
    queryKey: ["latest-context"],
    queryFn: () => latestFn(),
  });

  const extraction: ContextExtraction | null = data
    ? (contextExtractionSchema.safeParse({
        context_summary: data.summary ?? "",
        goals: data.extracted_goals ?? [],
        tasks: data.extracted_tasks ?? [],
        deadlines: data.extracted_deadlines ?? [],
        constraints: data.constraints ?? [],
        available_time: data.available_time ?? [],
        dependencies: data.dependencies ?? [],
        progress: data.progress ?? [],
        open_questions: [],
      }).data ?? null)
    : null;

  useEffect(() => {
    const suggested = extraction?.available_time?.[0]?.minutes;
    if (suggested) setMinutes(String(suggested));
  }, [extraction?.available_time?.[0]?.minutes]);

  const confirm = useMutation({
    mutationFn: async () => {
      if (!data || !extraction) throw new Error("Nothing to confirm");
      setAiState("PLANNING");
      return confirmFn({
        data: {
          context_id: data.id,
          extraction,
          available_minutes: Math.max(15, Math.min(960, Number(minutes) || 180)),
        },
      });
    },
    onSuccess: (result) => {
      toast.success(`Created ${result.counts.tasks} tasks and built your plan`);
      navigate({ to: "/dashboard" });
    },
    onError: (e: Error) => toast.error(e.message || "Could not build your plan"),
    onSettled: () => setAiState("IDLE"),
  });

  if (isLoading) return <div className="panel h-64 animate-pulse" />;

  if (!data || !extraction) {
    return (
      <div className="panel p-8 text-center">
        <h1 className="text-2xl font-semibold">Nothing captured yet</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Capture your information first and LifeOS will show you exactly what it understood.
        </p>
        <Button className="mt-6" asChild>
          <Link to="/capture">Capture information</Link>
        </Button>
      </div>
    );
  }

  return (
    <>
      <AmbientBackground state={aiState} density="subtle" />
      <div className="relative z-10 space-y-6">
        <header>
          <p className="label-caps">Context review</p>
          <h1 className="mt-2 text-3xl font-semibold">Here's what LifeOS understood</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            {extraction.context_summary}
          </p>
          <p className="mt-2 font-mono text-xs text-muted-foreground">
            engine: {data.engine ?? "unknown"}
          </p>
        </header>

        <div className="grid gap-6 lg:grid-cols-2">
          <section className="panel p-5">
            <h2 className="text-lg font-semibold">Goals</h2>
            <ul className="mt-3 space-y-2">
              {extraction.goals.map((g) => (
                <li key={g.title} className="rounded-lg border border-border/60 p-3">
                  <p className="text-sm font-medium">{g.title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    importance {g.importance} · {g.deadline_text || "no stated timing"} ·{" "}
                    <span className={CERTAINTY_STYLE[g.certainty]}>{g.certainty}</span>
                  </p>
                </li>
              ))}
              {extraction.goals.length === 0 && (
                <li className="text-sm text-muted-foreground">No explicit goals found.</li>
              )}
            </ul>
          </section>

          <section className="panel p-5">
            <h2 className="text-lg font-semibold">Tasks</h2>
            <ul className="mt-3 space-y-2">
              {extraction.tasks.map((t) => (
                <li key={t.title} className="rounded-lg border border-border/60 p-3">
                  <p className="text-sm font-medium">{t.title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {formatMinutesLabel(t.estimated_minutes)} · importance {t.importance} · urgency{" "}
                    {t.urgency} · {t.progress}% done ·{" "}
                    <span className={CERTAINTY_STYLE[t.certainty]}>{t.certainty}</span>
                  </p>
                  {t.deadline_text && (
                    <p className="mt-1 text-xs text-muted-foreground">due: {t.deadline_text}</p>
                  )}
                </li>
              ))}
              {extraction.tasks.length === 0 && (
                <li className="text-sm text-muted-foreground">No tasks found.</li>
              )}
            </ul>
          </section>

          <section className="panel p-5">
            <h2 className="text-lg font-semibold">Deadlines</h2>
            <ul className="mt-3 space-y-2">
              {extraction.deadlines.map((d) => (
                <li key={d.title} className="rounded-lg border border-border/60 p-3 text-sm">
                  <span className="font-medium">{d.title}</span>
                  <span className="ml-2 text-xs text-muted-foreground">
                    {d.due_text || d.due_at || "timing unclear"}
                  </span>
                </li>
              ))}
              {extraction.deadlines.length === 0 && (
                <li className="text-sm text-muted-foreground">No deadlines detected.</li>
              )}
            </ul>
          </section>

          <section className="panel p-5">
            <h2 className="text-lg font-semibold">Constraints & time</h2>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              {extraction.constraints.map((c) => (
                <li key={c} className="flex gap-2">
                  <HelpCircle className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--color-warning)]" />
                  {c}
                </li>
              ))}
              {extraction.available_time.map((a) => (
                <li key={a.label} className="flex gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--color-success)]" />
                  {a.label} — {formatMinutesLabel(a.minutes)}
                </li>
              ))}
              {extraction.constraints.length === 0 && extraction.available_time.length === 0 && (
                <li>Nothing stated about your constraints.</li>
              )}
            </ul>
          </section>
        </div>

        <section className="focal-panel flex flex-wrap items-end gap-4 p-5">
          <div className="w-40 space-y-1.5">
            <Label htmlFor="minutes">Time available (min)</Label>
            <Input
              id="minutes"
              type="number"
              min={15}
              max={960}
              value={minutes}
              onChange={(e) => setMinutes(e.target.value)}
            />
          </div>
          <Button size="lg" onClick={() => confirm.mutate()} disabled={confirm.isPending}>
            {confirm.isPending ? "Building your plan…" : "Confirm & build my plan"}
          </Button>
          <Button variant="ghost" asChild>
            <Link to="/capture">Capture more</Link>
          </Button>
        </section>
      </div>
    </>
  );
}
