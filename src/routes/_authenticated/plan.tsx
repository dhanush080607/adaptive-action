import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AmbientBackground, type AmbientState } from "@/components/lifeos/AmbientBackground";
import { PlanTimeline, type TimelineItem } from "@/components/lifeos/PlanTimeline";
import { getDashboard, replan } from "@/lib/lifeos/api.functions";
import { formatMinutesLabel } from "@/lib/lifeos/format";

export const Route = createFileRoute("/_authenticated/plan")({
  head: () => ({
    meta: [
      { title: "Your plan — LifeOS" },
      {
        name: "description",
        content: "A realistic, time-boxed session plan with breaks and deferred work.",
      },
      { property: "og:title", content: "Your plan — LifeOS" },
      { property: "og:description", content: "Realistic planning that adapts to reality." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PlanPage,
});

function PlanPage() {
  const queryClient = useQueryClient();
  const dashboardFn = useServerFn(getDashboard);
  const replanFn = useServerFn(replan);
  const [minutes, setMinutes] = useState("");
  const [aiState, setAiState] = useState<AmbientState>("IDLE");

  const { data, isLoading } = useQuery({ queryKey: ["dashboard"], queryFn: () => dashboardFn() });

  const rebuild = useMutation({
    mutationFn: async () => {
      setAiState("PLANNING");
      const value = Number(minutes);
      return replanFn({
        data: Number.isFinite(value) && value >= 15 ? { available_minutes: value } : {},
      });
    },
    onSuccess: async () => {
      toast.success("Plan rebuilt");
      await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (e: Error) => toast.error(e.message || "Could not rebuild the plan"),
    onSettled: () => setAiState("IDLE"),
  });

  const plan = data?.plan ?? null;
  const items = (data?.plan_items ?? []) as TimelineItem[];
  const warnings = (plan?.warnings ?? []) as string[];

  return (
    <>
      <AmbientBackground state={aiState} density="subtle" />
      <div className="relative z-10 space-y-6">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="label-caps">Planning engine</p>
            <h1 className="mt-2 text-3xl font-semibold">Your session plan</h1>
            {plan && <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{plan.summary}</p>}
          </div>
          <div className="flex items-end gap-2">
            <div className="w-32 space-y-1.5">
              <Label htmlFor="minutes">Minutes</Label>
              <Input
                id="minutes"
                type="number"
                min={15}
                max={960}
                placeholder={String(plan?.available_minutes ?? 180)}
                value={minutes}
                onChange={(e) => setMinutes(e.target.value)}
              />
            </div>
            <Button onClick={() => rebuild.mutate()} disabled={rebuild.isPending}>
              <RefreshCw className={`mr-1.5 h-4 w-4 ${rebuild.isPending ? "animate-spin" : ""}`} />
              Rebuild
            </Button>
          </div>
        </header>

        {plan?.reasoning && (
          <section className="panel p-5">
            <p className="label-caps">Why this plan</p>
            <p className="mt-2 text-sm text-foreground/90">{plan.reasoning}</p>
            <p className="mt-2 font-mono text-xs text-muted-foreground">
              window {formatMinutesLabel(plan.available_minutes ?? 0)} ·{" "}
              {plan.is_replan ? "replan" : "initial plan"}
            </p>
          </section>
        )}

        {warnings.length > 0 && (
          <section className="panel border-[color:var(--color-warning)]/40 p-5">
            <p className="label-caps flex items-center gap-2 text-[color:var(--color-warning)]">
              <AlertTriangle className="h-3.5 w-3.5" /> Reality check
            </p>
            <ul className="mt-2 space-y-1.5 text-sm text-muted-foreground">
              {warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          </section>
        )}

        <section className="panel p-5 sm:p-6">
          <h2 className="text-lg font-semibold">Timeline</h2>
          <div className="mt-4">
            {isLoading ? (
              <div className="h-40 animate-pulse rounded-lg bg-muted/40" />
            ) : (
              <PlanTimeline items={items} highlightTaskId={data?.next_action?.task_id ?? null} />
            )}
          </div>
          {items.length === 0 && !isLoading && (
            <Button className="mt-5" asChild>
              <Link to="/capture">Capture information to build a plan</Link>
            </Button>
          )}
        </section>
      </div>
    </>
  );
}
