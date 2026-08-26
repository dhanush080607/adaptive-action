import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import {
  AlertTriangle,
  RefreshCw,
  Clock3,
  Sparkles,
  BrainCircuit,
  ArrowRight,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import {
  AmbientBackground,
  type AmbientState,
} from "@/components/lifeos/AmbientBackground";

import {
  PlanTimeline,
  type TimelineItem,
} from "@/components/lifeos/PlanTimeline";

import {
  getDashboard,
  replan,
} from "@/lib/lifeos/api.functions";

import { formatMinutesLabel } from "@/lib/lifeos/format";

export const Route = createFileRoute("/_authenticated/plan")({
  head: () => ({
    meta: [
      { title: "Your plan — LifeOS" },
      {
        name: "description",
        content:
          "A realistic, time-boxed session plan with breaks and deferred work.",
      },
      {
        property: "og:title",
        content: "Your plan — LifeOS",
      },
      {
        property: "og:description",
        content: "Realistic planning that adapts to reality.",
      },
      {
        property: "og:type",
        content: "website",
      },
      {
        name: "twitter:card",
        content: "summary_large_image",
      },
    ],
  }),

  component: PlanPage,
});

function PlanPage() {
  const queryClient = useQueryClient();

  const dashboardFn = useServerFn(getDashboard);
  const replanFn = useServerFn(replan);

  const [minutes, setMinutes] = useState("");
  const [aiState, setAiState] =
    useState<AmbientState>("IDLE");

  const {
    data,
    isLoading,
  } = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => dashboardFn(),
  });

  const rebuild = useMutation({
    mutationFn: async () => {
      setAiState("PLANNING");

      const value = Number(minutes);

      return replanFn({
        data:
          Number.isFinite(value) && value >= 15
            ? {
                available_minutes: value,
              }
            : {},
      });
    },

    onSuccess: async () => {
      toast.success("Plan rebuilt around your available time");

      await queryClient.invalidateQueries({
        queryKey: ["dashboard"],
      });
    },

    onError: (e: Error) => {
      toast.error(
        e.message ||
          "Could not rebuild the plan",
      );
    },

    onSettled: () => {
      setAiState("IDLE");
    },
  });

  const plan = data?.plan ?? null;

  const items =
    (data?.plan_items ?? []) as TimelineItem[];

  const warnings =
    (plan?.warnings ?? []) as string[];

  return (
    <>
      {/* ------------------------------------------------------------------ */}
      {/* Black-hole / ambient background                                   */}
      {/* ------------------------------------------------------------------ */}

      <AmbientBackground
        state={aiState}
        density="subtle"
      />

      {/* ------------------------------------------------------------------ */}
      {/* Page                                                               */}
      {/* ------------------------------------------------------------------ */}

      <div className="relative z-10 space-y-7 fade-in">

        {/* ================================================================ */}
        {/* HEADER                                                           */}
        {/* ================================================================ */}

        <header className="relative overflow-hidden rounded-3xl border border-white/10 bg-black/25 p-6 backdrop-blur-xl shadow-2xl">

          {/* Ambient glow inside header */}
          <div className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-primary/10 blur-3xl" />

          <div className="pointer-events-none absolute -bottom-24 -left-24 h-56 w-56 rounded-full bg-violet-500/10 blur-3xl" />

          <div className="relative flex flex-wrap items-end justify-between gap-6">

            {/* Title */}
            <div className="max-w-2xl">

              <div className="mb-2 flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-primary/20 bg-primary/10">
                  <BrainCircuit className="h-4 w-4 text-primary" />
                </div>

                <p className="label-caps text-primary">
                  Planning engine
                </p>
              </div>

              <h1 className="text-3xl font-semibold tracking-tight text-gradient sm:text-4xl">
                Your session plan
              </h1>

              <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
                {plan?.summary ??
                  "LifeOS turns your priorities into a realistic execution schedule."}
              </p>

              {plan && (
                <div className="mt-4 flex flex-wrap items-center gap-2">

                  <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 backdrop-blur-md">
                    <Clock3 className="h-3.5 w-3.5 text-primary" />

                    <span className="font-mono text-xs text-muted-foreground">
                      {formatMinutesLabel(
                        plan.available_minutes ?? 0,
                      )}
                    </span>
                  </div>

                  <div className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 backdrop-blur-md">
                    <span className="font-mono text-xs text-muted-foreground">
                      {plan.is_replan
                        ? "Adaptive replan"
                        : "Initial plan"}
                    </span>
                  </div>

                </div>
              )}
            </div>

            {/* Rebuild controls */}
            <div className="flex flex-wrap items-end gap-2">

              <div className="w-32 space-y-1.5">
                <Label
                  htmlFor="minutes"
                  className="text-xs text-muted-foreground"
                >
                  Available minutes
                </Label>

                <Input
                  id="minutes"
                  type="number"
                  min={15}
                  max={960}
                  placeholder={String(
                    plan?.available_minutes ?? 180,
                  )}
                  value={minutes}
                  onChange={(e) =>
                    setMinutes(e.target.value)
                  }
                  className="border-white/10 bg-black/30 backdrop-blur-md focus:border-primary/50 focus:ring-primary/20"
                />
              </div>

              <Button
                onClick={() => rebuild.mutate()}
                disabled={rebuild.isPending}
                className="border border-primary/30 bg-primary/10 text-primary shadow-[0_0_25px_rgba(0,220,255,0.08)] transition-all hover:border-primary/60 hover:bg-primary/20 hover:shadow-[0_0_30px_rgba(0,220,255,0.15)]"
              >
                <RefreshCw
                  className={`mr-2 h-4 w-4 ${
                    rebuild.isPending
                      ? "animate-spin"
                      : ""
                  }`}
                />

                {rebuild.isPending
                  ? "Rebuilding..."
                  : "Rebuild plan"}
              </Button>

            </div>
          </div>
        </header>

        {/* ================================================================ */}
        {/* AI REASONING                                                     */}
        {/* ================================================================ */}

        {plan?.reasoning && (
          <section className="group relative overflow-hidden rounded-2xl border border-primary/15 bg-black/25 p-5 backdrop-blur-xl transition-all duration-300 hover:border-primary/30 hover:bg-black/30">

            {/* Glow */}
            <div className="pointer-events-none absolute -right-20 -top-20 h-40 w-40 rounded-full bg-primary/10 blur-3xl opacity-60 transition-opacity group-hover:opacity-100" />

            <div className="relative flex gap-4">

              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/10">
                <Sparkles className="h-4.5 w-4.5 text-primary" />
              </div>

              <div className="min-w-0">

                <p className="label-caps text-primary">
                  Why LifeOS chose this plan
                </p>

                <p className="mt-2 text-sm leading-relaxed text-foreground/90">
                  {plan.reasoning}
                </p>

                <div className="mt-3 flex items-center gap-2 font-mono text-xs text-muted-foreground">
                  <Clock3 className="h-3.5 w-3.5" />

                  <span>
                    Window{" "}
                    {formatMinutesLabel(
                      plan.available_minutes ?? 0,
                    )}
                  </span>

                  <span className="text-border">
                    •
                  </span>

                  <span>
                    {plan.is_replan
                      ? "Adapted after feedback"
                      : "Generated from current context"}
                  </span>
                </div>

              </div>
            </div>
          </section>
        )}

        {/* ================================================================ */}
        {/* REALITY CHECK                                                    */}
        {/* ================================================================ */}

        {warnings.length > 0 && (
          <section className="relative overflow-hidden rounded-2xl border border-warning/30 bg-warning/[0.04] p-5 backdrop-blur-xl">

            <div className="pointer-events-none absolute right-0 top-0 h-40 w-40 rounded-full bg-warning/10 blur-3xl" />

            <div className="relative flex gap-4">

              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-warning/20 bg-warning/10">
                <AlertTriangle className="h-4.5 w-4.5 text-warning" />
              </div>

              <div>

                <p className="label-caps text-warning">
                  Reality check
                </p>

                <p className="mt-1 text-xs text-muted-foreground">
                  LifeOS found work that may not fit inside your
                  current available window.
                </p>

                <ul className="mt-3 space-y-2">
                  {warnings.map((warning) => (
                    <li
                      key={warning}
                      className="flex gap-2 text-sm text-foreground/80"
                    >
                      <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-warning" />
                      <span>{warning}</span>
                    </li>
                  ))}
                </ul>

              </div>
            </div>
          </section>
        )}

        {/* ================================================================ */}
        {/* MAIN TIMELINE                                                    */}
        {/* ================================================================ */}

        <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-black/25 p-5 shadow-2xl backdrop-blur-xl sm:p-6">

          {/* Black-hole glow behind timeline */}
          <div className="pointer-events-none absolute -left-32 top-1/3 h-72 w-72 rounded-full bg-primary/[0.06] blur-3xl" />

          <div className="pointer-events-none absolute -right-32 bottom-0 h-72 w-72 rounded-full bg-violet-500/[0.06] blur-3xl" />

          {/* Timeline header */}
          <div className="relative flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.07] pb-4">

            <div>
              <div className="flex items-center gap-2">

                <div className="h-2 w-2 animate-pulse rounded-full bg-primary shadow-[0_0_12px_rgba(0,220,255,0.8)]" />

                <h2 className="text-lg font-semibold tracking-tight">
                  Execution timeline
                </h2>

              </div>

              <p className="mt-1 text-xs text-muted-foreground">
                Your highest-value work, arranged around the time
                you actually have.
              </p>
            </div>

            {items.length > 0 && (
              <div className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 backdrop-blur-md">
                <span className="font-mono text-xs text-muted-foreground">
                  {items.length}{" "}
                  {items.length === 1
                    ? "block"
                    : "blocks"}
                </span>
              </div>
            )}

          </div>

          {/* Timeline */}
          <div className="relative mt-6">

            {isLoading ? (
              <div className="space-y-3">

                {[1, 2, 3].map((item) => (
                  <div
                    key={item}
                    className="h-20 animate-pulse rounded-2xl border border-white/[0.05] bg-white/[0.025]"
                  />
                ))}

              </div>
            ) : (
              <PlanTimeline
                items={items}
                highlightTaskId={
                  data?.next_action?.task_id ??
                  null
                }
              />
            )}

          </div>

          {/* Empty state */}
          {items.length === 0 &&
            !isLoading && (
              <div className="relative mt-5 overflow-hidden rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-8 text-center backdrop-blur-md">

                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10">
                  <Sparkles className="h-5 w-5 text-primary" />
                </div>

                <h3 className="mt-4 text-sm font-semibold">
                  No plan yet
                </h3>

                <p className="mx-auto mt-2 max-w-sm text-xs leading-relaxed text-muted-foreground">
                  Give LifeOS some context and it will build a
                  realistic schedule around your priorities.
                </p>

                <Button
                  className="mt-5 border border-primary/30 bg-primary/10 text-primary hover:bg-primary/20"
                  asChild
                >
                  <Link to="/capture">
                    Capture information

                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>

              </div>
            )}

        </section>

        {/* ================================================================ */}
        {/* FOOTER STATUS                                                    */}
        {/* ================================================================ */}

        {plan && (
          <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 pb-2 text-center font-mono text-[10px] uppercase tracking-widest text-muted-foreground/60">

            <span>
              LifeOS Planning Engine
            </span>

            <span className="hidden sm:block text-border">
              /
            </span>

            <span>
              {plan.is_replan
                ? "Adaptive planning active"
                : "Initial planning active"}
            </span>

            <span className="hidden sm:block text-border">
              /
            </span>

            <span>
              Reality-aware scheduling
            </span>

          </div>
        )}

      </div>
    </>
  );
}