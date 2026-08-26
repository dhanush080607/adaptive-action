import { createFileRoute, Link } from "@tanstack/react-router";
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import {
  CalendarClock,
  RefreshCw,
  Target,
  PlusCircle,
  Activity,
  ChevronRight,
  CheckCircle2,
  Clock,
  AlertCircle,
  Sparkles,
  Layers3,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  AmbientBackground,
  type AmbientState,
} from "@/components/lifeos/AmbientBackground";
import { NextActionCard } from "@/components/lifeos/NextActionCard";
import {
  PlanTimeline,
  type TimelineItem,
} from "@/components/lifeos/PlanTimeline";
import { FeedbackDialog } from "@/components/lifeos/FeedbackDialog";
import { PriorityBadge } from "@/components/lifeos/PriorityBadge";

import {
  getDashboard,
  replan,
  submitFeedback,
  updateTask,
} from "@/lib/lifeos/api.functions";

import {
  formatDue,
  formatMinutesLabel,
  greeting,
  STATUS_LABELS,
} from "@/lib/lifeos/format";

import type { FeedbackKind } from "@/lib/lifeos/types";

export const Route = createFileRoute(
  "/_authenticated/dashboard",
)({
  head: () => ({
    meta: [
      {
        title: "Dashboard — LifeOS",
      },
      {
        name: "description",
        content:
          "Your next best action, live plan and priority queue in one place.",
      },
      {
        property: "og:title",
        content: "Dashboard — LifeOS",
      },
      {
        property: "og:description",
        content:
          "One clear next action, always up to date.",
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

  component: Dashboard,
});

function Dashboard() {
  const queryClient = useQueryClient();

  const dashboardFn =
    useServerFn(getDashboard);

  const replanFn =
    useServerFn(replan);

  const feedbackFn =
    useServerFn(submitFeedback);

  const updateTaskFn =
    useServerFn(updateTask);

  const [aiState, setAiState] =
    useState<AmbientState>("IDLE");

  const [feedbackOpen, setFeedbackOpen] =
    useState(false);

  const [previousItems, setPreviousItems] =
    useState<TimelineItem[] | null>(null);

  /* ---------------------------------------------------------------------- */
  /* Dashboard Query                                                        */
  /* ---------------------------------------------------------------------- */

  const {
    data,
    isLoading,
  } = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => dashboardFn(),
  });

  const invalidate = () =>
    queryClient.invalidateQueries({
      queryKey: ["dashboard"],
    });

  /* ---------------------------------------------------------------------- */
  /* Replan                                                                 */
  /* ---------------------------------------------------------------------- */

  const replanMutation =
    useMutation({
      mutationFn: async () => {
        setAiState("REPLANNING");

        return replanFn({
          data: {},
        });
      },

      onSuccess: async () => {
        toast.success(
          "Plan rebuilt around your remaining time",
        );

        await invalidate();
      },

      onError: (e: Error) => {
        toast.error(
          e.message ||
            "Could not replan",
        );
      },

      onSettled: () => {
        setAiState("IDLE");
      },
    });

  /* ---------------------------------------------------------------------- */
  /* Feedback                                                               */
  /* ---------------------------------------------------------------------- */

  const feedbackMutation =
    useMutation({
      mutationFn: async (payload: {
        kind: FeedbackKind;
        note?: string;
        actual_minutes?: number;
        progress?: number;
      }) => {
        const taskId =
          data?.next_action?.task_id;

        if (!taskId) {
          throw new Error(
            "No active task",
          );
        }

        setAiState("REPLANNING");

        setPreviousItems(
          (data?.plan_items ??
            []) as TimelineItem[],
        );

        return feedbackFn({
          data: {
            task_id: taskId,
            ...payload,
          },
        });
      },

      onSuccess: async (result) => {
        setFeedbackOpen(false);

        toast.success(
          result.replanned
            ? "Plan adapted to what actually happened"
            : result.evaluation.outcome,
        );

        await invalidate();

        setTimeout(() => {
          setPreviousItems(null);
        }, 600);
      },

      onError: (e: Error) => {
        toast.error(
          e.message ||
            "Could not save feedback",
        );
      },

      onSettled: () => {
        setAiState("IDLE");
      },
    });

  /* ---------------------------------------------------------------------- */
  /* Start Task                                                             */
  /* ---------------------------------------------------------------------- */

  const startMutation =
    useMutation({
      mutationFn: async (
        taskId: string,
      ) =>
        updateTaskFn({
          data: {
            id: taskId,
            patch: {
              status: "in_progress",
            },
          },
        }),

      onSuccess: async () => {
        toast.success(
          "Focus session started",
        );

        await invalidate();
      },

      onError: (e: Error) => {
        toast.error(
          e.message ||
            "Could not start task",
        );
      },
    });

  /* ---------------------------------------------------------------------- */
  /* Derived State                                                          */
  /* ---------------------------------------------------------------------- */

  const next =
    data?.next_action ?? null;

  const items =
    (previousItems ??
      data?.plan_items ??
      []) as TimelineItem[];

  const openTasks =
    (data?.tasks ?? []).filter(
      (task) =>
        [
          "pending",
          "in_progress",
          "delayed",
          "blocked",
        ].includes(task.status),
    );

  /* ---------------------------------------------------------------------- */
  /* Stats                                                                  */
  /* ---------------------------------------------------------------------- */

  const stats = [
    {
      label: "Open",
      value:
        data?.stats.open ?? 0,
      icon: Clock,
      color: "text-primary",
      glow: "shadow-[0_0_25px_hsl(var(--primary)/0.08)]",
    },

    {
      label: "Completed",
      value:
        data?.stats.completed ?? 0,
      icon: CheckCircle2,
      color: "text-success",
      glow: "shadow-[0_0_25px_hsl(var(--success)/0.08)]",
    },

    {
      label: "Delayed",
      value:
        data?.stats.delayed ?? 0,
      icon: AlertCircle,
      color: "text-warning",
      glow: "shadow-[0_0_25px_hsl(var(--warning)/0.08)]",
    },

    {
      label: "Blocked",
      value:
        data?.stats.blocked ?? 0,
      icon: AlertCircle,
      color: "text-destructive",
      glow: "shadow-[0_0_25px_hsl(var(--destructive)/0.08)]",
    },
  ];

  return (
    <>
      {/* ------------------------------------------------------------------ */}
      {/* Ambient Black-Hole Background                                     */}
      {/* ------------------------------------------------------------------ */}

      <AmbientBackground
        state={aiState}
        density="subtle"
      />

      {/* ------------------------------------------------------------------ */}
      {/* Main Dashboard                                                     */}
      {/* ------------------------------------------------------------------ */}

      <div className="relative z-10 space-y-8 fade-in">

        {/* ================================================================ */}
        {/* HEADER                                                           */}
        {/* ================================================================ */}

        <header
          className="
            relative
            overflow-hidden
            rounded-3xl
            border
            border-white/[0.08]
            bg-black/35
            backdrop-blur-xl
            px-6
            py-6
            shadow-[0_20px_80px_rgba(0,0,0,0.35)]
          "
        >
          {/* Ambient glow inside header */}

          <div
            className="
              pointer-events-none
              absolute
              -right-24
              -top-32
              h-64
              w-64
              rounded-full
              bg-primary/10
              blur-3xl
            "
          />

          <div
            className="
              pointer-events-none
              absolute
              -bottom-32
              left-1/3
              h-48
              w-48
              rounded-full
              bg-primary/5
              blur-3xl
            "
          />

          <div className="relative flex flex-wrap items-end justify-between gap-5">

            <div>
              <div className="flex items-center gap-2">
                <Sparkles className="h-3.5 w-3.5 text-primary" />

                <span className="label-caps text-primary/80">
                  {greeting()}
                </span>
              </div>

              <h1
                className="
                  mt-2
                  text-3xl
                  font-semibold
                  tracking-tight
                  text-gradient
                  sm:text-4xl
                "
              >
                {data?.profile?.name
                  ? `Ready, ${data.profile.name}?`
                  : "Your Action Center"}
              </h1>

              <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
                Your priorities, plans and next actions—
                continuously organized by LifeOS.
              </p>
            </div>

            <div className="relative flex items-center gap-3">

              {/* Capture */}

              <Button
                variant="secondary"
                asChild
                className="
                  border
                  border-white/[0.08]
                  bg-white/[0.04]
                  backdrop-blur-md
                  hover:border-primary/40
                  hover:bg-primary/[0.07]
                  transition-all
                "
              >
                <Link
                  to="/capture"
                  className="flex items-center gap-2"
                >
                  <PlusCircle className="h-4 w-4 text-primary" />

                  <span>
                    Capture Task
                  </span>
                </Link>
              </Button>

              {/* Replan */}

              <Button
                variant="outline"
                onClick={() =>
                  replanMutation.mutate()
                }
                disabled={
                  replanMutation.isPending
                }
                className="
                  border-primary/30
                  bg-primary/[0.06]
                  text-primary
                  shadow-[0_0_25px_hsl(var(--primary)/0.08)]
                  hover:border-primary/60
                  hover:bg-primary/[0.12]
                  transition-all
                "
              >
                <RefreshCw
                  className={`
                    mr-1.5
                    h-4
                    w-4
                    ${
                      replanMutation.isPending
                        ? "animate-spin"
                        : ""
                    }
                  `}
                />

                Replan
              </Button>
            </div>
          </div>
        </header>

        {/* ================================================================ */}
        {/* NEXT ACTION                                                      */}
        {/* ================================================================ */}

        <section
          className="
            relative
            rounded-3xl
            border
            border-primary/[0.12]
            bg-black/30
            p-1
            backdrop-blur-xl
            shadow-[0_25px_100px_rgba(0,0,0,0.4)]
          "
        >
          {/* Outer cyan glow */}

          <div
            className="
              pointer-events-none
              absolute
              inset-0
              rounded-3xl
              shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]
            "
          />

          {isLoading ? (
            <div
              className="
                h-56
                rounded-[1.35rem]
                border
                border-white/[0.06]
                bg-black/30
                animate-pulse
              "
            />
          ) : (
            <NextActionCard
              action={next}
              busy={
                startMutation.isPending ||
                feedbackMutation.isPending
              }
              onStart={() =>
                next &&
                startMutation.mutate(
                  next.task_id,
                )
              }
              onFeedback={() =>
                setFeedbackOpen(true)
              }
            />
          )}
        </section>

        {/* ================================================================ */}
        {/* SIGNAL STRIP                                                     */}
        {/* ================================================================ */}

        <section
          className="
            grid
            grid-cols-2
            gap-3
            lg:grid-cols-4
          "
        >
          {stats.map((stat) => {
            const Icon = stat.icon;

            return (
              <div
                key={stat.label}
                className={`
                  group
                  relative
                  overflow-hidden
                  rounded-2xl
                  border
                  border-white/[0.07]
                  bg-black/30
                  p-4
                  backdrop-blur-xl
                  transition-all
                  duration-300
                  hover:-translate-y-0.5
                  hover:border-primary/20
                  hover:bg-black/40
                  ${stat.glow}
                `}
              >
                {/* Hover glow */}

                <div
                  className="
                    pointer-events-none
                    absolute
                    -right-8
                    -top-8
                    h-20
                    w-20
                    rounded-full
                    bg-primary/5
                    blur-2xl
                    transition-opacity
                    group-hover:opacity-100
                  "
                />

                <div className="relative flex items-center justify-between">
                  <span className="label-caps text-[10px]">
                    {stat.label}
                  </span>

                  <Icon
                    className={`h-4 w-4 ${stat.color}`}
                  />
                </div>

                <div
                  className="
                    relative
                    mt-2
                    font-mono
                    text-2xl
                    font-semibold
                    tracking-tight
                  "
                >
                  {stat.value}
                </div>
              </div>
            );
          })}
        </section>

        {/* ================================================================ */}
        {/* MAIN GRID                                                        */}
        {/* ================================================================ */}

        <div
          className="
            grid
            gap-6
            lg:grid-cols-[1.4fr_1fr]
          "
        >

          {/* ============================================================ */}
          {/* PLAN TIMELINE                                                 */}
          {/* ============================================================ */}

          <section
            className="
              group
              relative
              overflow-hidden
              rounded-3xl
              border
              border-white/[0.08]
              bg-black/30
              p-6
              backdrop-blur-xl
              shadow-[0_20px_70px_rgba(0,0,0,0.3)]
              transition-all
              duration-300
              hover:border-primary/15
            "
          >
            {/* Background orbital glow */}

            <div
              className="
                pointer-events-none
                absolute
                -left-32
                top-20
                h-64
                w-64
                rounded-full
                bg-primary/[0.035]
                blur-3xl
              "
            />

            <div className="relative">

              {/* Section Header */}

              <div
                className="
                  flex
                  items-center
                  justify-between
                  border-b
                  border-white/[0.07]
                  pb-4
                "
              >
                <h2
                  className="
                    flex
                    items-center
                    gap-2
                    text-base
                    font-medium
                    tracking-tight
                  "
                >
                  <CalendarClock className="h-4.5 w-4.5 text-primary" />

                  Today's Focus Schedule
                </h2>

                <Link
                  to="/plan"
                  className="
                    group/link
                    flex
                    items-center
                    gap-1
                    text-xs
                    text-muted-foreground
                    transition-colors
                    hover:text-primary
                  "
                >
                  <span>
                    Full Timeline
                  </span>

                  <ChevronRight
                    className="
                      h-3.5
                      w-3.5
                      transition-transform
                      group-hover/link:translate-x-0.5
                    "
                  />
                </Link>
              </div>

              {/* Timeline */}

              <div className="pt-5">
                <PlanTimeline
                  items={items}
                  highlightTaskId={
                    next?.task_id ?? null
                  }
                />
              </div>
            </div>
          </section>

          {/* ============================================================ */}
          {/* RIGHT COLUMN                                                  */}
          {/* ============================================================ */}

          <div className="space-y-6">

            {/* ========================================================== */}
            {/* SIGNALS                                                     */}
            {/* ========================================================== */}

            <section
              className="
                relative
                overflow-hidden
                rounded-3xl
                border
                border-white/[0.08]
                bg-black/30
                p-6
                backdrop-blur-xl
                shadow-[0_20px_70px_rgba(0,0,0,0.3)]
              "
            >
              <div
                className="
                  pointer-events-none
                  absolute
                  -right-20
                  -top-20
                  h-40
                  w-40
                  rounded-full
                  bg-primary/5
                  blur-3xl
                "
              />

              <div
                className="
                  relative
                  flex
                  items-center
                  gap-2
                  border-b
                  border-white/[0.07]
                  pb-4
                  text-base
                  font-medium
                "
              >
                <Activity className="h-4.5 w-4.5 text-primary" />

                System Signals
              </div>

              <dl
                className="
                  relative
                  mt-4
                  grid
                  grid-cols-2
                  gap-3
                "
              >
                {stats.map((stat) => {
                  const Icon = stat.icon;

                  return (
                    <div
                      key={stat.label}
                      className="
                        group
                        rounded-2xl
                        border
                        border-white/[0.07]
                        bg-white/[0.025]
                        p-4
                        backdrop-blur-md
                        transition-all
                        duration-300
                        hover:border-primary/20
                        hover:bg-primary/[0.035]
                      "
                    >
                      <dt
                        className="
                          flex
                          items-center
                          justify-between
                          label-caps
                          text-[10px]
                        "
                      >
                        <span>
                          {stat.label}
                        </span>

                        <Icon
                          className={`
                            h-3.5
                            w-3.5
                            ${stat.color}
                          `}
                        />
                      </dt>

                      <dd
                        className="
                          mt-2
                          font-mono
                          text-2xl
                          font-semibold
                          tracking-tight
                        "
                      >
                        {stat.value}
                      </dd>
                    </div>
                  );
                })}
              </dl>
            </section>

            {/* ========================================================== */}
            {/* PRIORITY QUEUE                                               */}
            {/* ========================================================== */}

            <section
              className="
                relative
                overflow-hidden
                rounded-3xl
                border
                border-white/[0.08]
                bg-black/30
                p-6
                backdrop-blur-xl
                shadow-[0_20px_70px_rgba(0,0,0,0.3)]
              "
            >
              {/* Background glow */}

              <div
                className="
                  pointer-events-none
                  absolute
                  -left-20
                  -bottom-20
                  h-44
                  w-44
                  rounded-full
                  bg-primary/5
                  blur-3xl
                "
              />

              <div
                className="
                  relative
                  flex
                  items-center
                  justify-between
                  border-b
                  border-white/[0.07]
                  pb-4
                "
              >
                <h2
                  className="
                    flex
                    items-center
                    gap-2
                    text-base
                    font-medium
                  "
                >
                  <Target className="h-4.5 w-4.5 text-primary" />

                  Priority Queue
                </h2>

                <span
                  className="
                    rounded-full
                    border
                    border-white/[0.07]
                    bg-white/[0.025]
                    px-2.5
                    py-1
                    font-mono
                    text-[10px]
                    text-muted-foreground
                  "
                >
                  {openTasks.length} pending
                </span>
              </div>

              <ul className="relative mt-4 space-y-2.5">

                {openTasks
                  .slice(0, 6)
                  .map((task) => (
                    <li key={task.id}>
                      <Link
                        to="/tasks/$id"
                        params={{
                          id: task.id,
                        }}
                        className="
                          group
                          relative
                          flex
                          items-center
                          justify-between
                          gap-3
                          overflow-hidden
                          rounded-2xl
                          border
                          border-white/[0.07]
                          bg-white/[0.02]
                          p-3.5
                          backdrop-blur-md
                          transition-all
                          duration-300
                          hover:border-primary/30
                          hover:bg-primary/[0.045]
                          hover:shadow-[0_0_30px_hsl(var(--primary)/0.06)]
                        "
                      >
                        {/* Active hover line */}

                        <span
                          className="
                            absolute
                            left-0
                            top-0
                            h-full
                            w-0.5
                            bg-primary
                            opacity-0
                            transition-opacity
                            group-hover:opacity-100
                          "
                        />

                        <span className="min-w-0 flex-1 space-y-1">

                          <span
                            className="
                              block
                              truncate
                              text-sm
                              font-medium
                              text-foreground/90
                              transition-colors
                              group-hover:text-primary
                            "
                          >
                            {task.title}
                          </span>

                          <span
                            className="
                              block
                              text-xs
                              font-mono
                              text-muted-foreground
                            "
                          >
                            {STATUS_LABELS[
                              task.status
                            ] ??
                              task.status}{" "}
                            ·{" "}
                            {formatMinutesLabel(
                              task.estimated_minutes,
                            )}{" "}
                            ·{" "}
                            {formatDue(
                              task.deadline,
                            )}
                          </span>
                        </span>

                        <PriorityBadge
                          level={task.priority}
                        />
                      </Link>
                    </li>
                  ))}

                {openTasks.length === 0 && (
                  <li
                    className="
                      flex
                      flex-col
                      items-center
                      justify-center
                      rounded-2xl
                      border
                      border-dashed
                      border-white/[0.10]
                      bg-white/[0.015]
                      px-5
                      py-8
                      text-center
                    "
                  >
                    <Layers3 className="mb-2 h-5 w-5 text-primary/60" />

                    <span className="text-xs text-muted-foreground">
                      Queue clear.
                    </span>

                    <span className="mt-1 text-[11px] text-muted-foreground/60">
                      Capture new information to populate your workflow.
                    </span>
                  </li>
                )}
              </ul>
            </section>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Feedback Dialog                                                    */}
      {/* ------------------------------------------------------------------ */}

      {next && (
        <FeedbackDialog
          open={feedbackOpen}
          onOpenChange={
            setFeedbackOpen
          }
          taskTitle={next.task}
          estimatedMinutes={
            next.estimated_minutes
          }
          submitting={
            feedbackMutation.isPending
          }
          onSubmit={(payload) =>
            feedbackMutation.mutate(
              payload,
            )
          }
        />
      )}
    </>
  );
}