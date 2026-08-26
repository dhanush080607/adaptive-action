import {
  createFileRoute,
  Link,
  useNavigate,
} from "@tanstack/react-router";

import {
  useMutation,
  useQuery,
} from "@tanstack/react-query";

import { useServerFn } from "@tanstack/react-start";

import { useEffect, useState } from "react";

import { toast } from "sonner";

import {
  CheckCircle2,
  HelpCircle,
  BrainCircuit,
  Clock3,
  Target,
  ListChecks,
  CalendarClock,
  ShieldCheck,
  Sparkles,
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
  confirmContext,
  getLatestContext,
} from "@/lib/lifeos/api.functions";

import {
  contextExtractionSchema,
  type ContextExtraction,
} from "@/lib/lifeos/types";

import {
  formatMinutesLabel,
} from "@/lib/lifeos/format";

export const Route = createFileRoute(
  "/_authenticated/context",
)({
  head: () => ({
    meta: [
      {
        title: "Review Context — LifeOS",
      },
      {
        name: "description",
        content:
          "Check what LifeOS understood from your input before it builds your plan.",
      },
      {
        property: "og:title",
        content: "Review Context — LifeOS",
      },
      {
        property: "og:description",
        content:
          "Transparent AI understanding you can correct.",
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

  component: ContextReview,
});

const CERTAINTY_STYLE: Record<
  string,
  string
> = {
  explicit:
    "text-[color:var(--color-success)]",

  inferred:
    "text-[color:var(--color-warning)]",

  uncertain:
    "text-destructive",
};

function ContextReview() {
  const navigate = useNavigate();

  const latestFn =
    useServerFn(getLatestContext);

  const confirmFn =
    useServerFn(confirmContext);

  const [minutes, setMinutes] =
    useState("180");

  const [aiState, setAiState] =
    useState<AmbientState>("IDLE");

  const {
    data,
    isLoading,
  } = useQuery({
    queryKey: ["latest-context"],
    queryFn: () => latestFn(),
  });

  const extraction:
    | ContextExtraction
    | null = data
    ? (contextExtractionSchema.safeParse(
        {
          context_summary:
            data.summary ?? "",

          goals:
            data.extracted_goals ??
            [],

          tasks:
            data.extracted_tasks ??
            [],

          deadlines:
            data.extracted_deadlines ??
            [],

          constraints:
            data.constraints ?? [],

          available_time:
            data.available_time ??
            [],

          dependencies:
            data.dependencies ??
            [],

          progress:
            data.progress ?? [],

          open_questions: [],
        },
      ).data ?? null)
    : null;

  const suggestedMinutes =
    extraction
      ?.available_time?.[0]
      ?.minutes ?? null;

  useEffect(() => {
    if (suggestedMinutes) {
      setMinutes(
        String(suggestedMinutes),
      );
    }
  }, [suggestedMinutes]);

  const confirm = useMutation({
    mutationFn: async () => {
      if (!data || !extraction) {
        throw new Error(
          "Nothing to confirm",
        );
      }

      setAiState("PLANNING");

      return confirmFn({
        data: {
          context_id: data.id,

          extraction,

          available_minutes:
            Math.max(
              15,
              Math.min(
                960,
                Number(minutes) ||
                  180,
              ),
            ),
        },
      });
    },

    onSuccess: (result) => {
      toast.success(
        `Created ${result.counts.tasks} tasks and built your plan`,
      );

      navigate({
        to: "/dashboard",
      });
    },

    onError: (e: Error) => {
      toast.error(
        e.message ||
          "Could not build your plan",
      );
    },

    onSettled: () => {
      setAiState("IDLE");
    },
  });

  /* ============================================================= */
  /* LOADING                                                        */
  /* ============================================================= */

  if (isLoading) {
    return (
      <div className="relative min-h-[500px]">
        <AmbientBackground
          state="IDLE"
          density="subtle"
        />

        <div
          className="
            relative
            z-10
            overflow-hidden
            rounded-3xl
            border
            border-white/[0.08]
            bg-black/20
            p-8
            backdrop-blur-2xl
            shadow-[0_25px_100px_rgba(0,0,0,0.45)]
          "
        >
          <div className="space-y-5 animate-pulse">
            <div className="h-4 w-32 rounded bg-white/[0.06]" />

            <div className="h-10 w-2/3 rounded bg-white/[0.06]" />

            <div className="h-4 w-3/4 rounded bg-white/[0.04]" />

            <div className="grid gap-5 lg:grid-cols-2">
              <div className="h-48 rounded-2xl bg-white/[0.04]" />
              <div className="h-48 rounded-2xl bg-white/[0.04]" />
              <div className="h-48 rounded-2xl bg-white/[0.04]" />
              <div className="h-48 rounded-2xl bg-white/[0.04]" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ============================================================= */
  /* EMPTY STATE                                                     */
  /* ============================================================= */

  if (!data || !extraction) {
    return (
      <div className="relative min-h-[500px]">
        <AmbientBackground
          state="IDLE"
          density="subtle"
        />

        <div
          className="
            relative
            z-10
            flex
            min-h-[420px]
            items-center
            justify-center
          "
        >
          <div
            className="
              relative
              w-full
              max-w-lg
              overflow-hidden
              rounded-3xl
              border
              border-white/[0.09]
              bg-black/25
              p-10
              text-center
              backdrop-blur-2xl
              shadow-[0_25px_100px_rgba(0,0,0,0.45)]
            "
          >
            <div
              className="
                mx-auto
                flex
                h-16
                w-16
                items-center
                justify-center
                rounded-2xl
                border
                border-primary/20
                bg-primary/[0.06]
              "
            >
              <BrainCircuit
                className="
                  h-7
                  w-7
                  text-primary
                "
              />
            </div>

            <h1
              className="
                mt-6
                text-2xl
                font-semibold
                tracking-tight
              "
            >
              Nothing captured yet
            </h1>

            <p
              className="
                mx-auto
                mt-3
                max-w-md
                text-sm
                leading-relaxed
                text-muted-foreground
              "
            >
              Capture your information
              first and LifeOS will show
              you exactly what it
              understood.
            </p>

            <Button
              className="
                mt-7
                border
                border-primary/40
                bg-primary/[0.08]
                text-primary
                hover:bg-primary/[0.14]
              "
              asChild
            >
              <Link to="/capture">
                <Sparkles className="mr-2 h-4 w-4" />
                Capture information
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* =========================================================== */}
      {/* BLACK HOLE BACKGROUND                                        */}
      {/* =========================================================== */}

      <AmbientBackground
        state={aiState}
        density="subtle"
      />

      <div
        className="
          relative
          z-10
          space-y-7
          fade-in
        "
      >

        {/* ========================================================= */}
        {/* HEADER                                                      */}
        {/* ========================================================= */}

        <header
          className="
            relative
            overflow-hidden
            rounded-3xl
            border
            border-white/[0.08]
            bg-black/20
            px-7
            py-6
            backdrop-blur-xl
            shadow-[0_20px_80px_rgba(0,0,0,0.35)]
          "
        >
          {/* Ambient glow */}

          <div
            className="
              pointer-events-none
              absolute
              -right-24
              -top-28
              h-64
              w-64
              rounded-full
              bg-primary/[0.05]
              blur-3xl
            "
          />

          <div className="relative">
            <div
              className="
                flex
                items-center
                gap-2
                text-primary
              "
            >
              <BrainCircuit className="h-4 w-4" />

              <p className="label-caps">
                Context Review
              </p>

              <span
                className="
                  ml-1
                  h-1.5
                  w-1.5
                  rounded-full
                  bg-primary
                  shadow-[0_0_10px_currentColor]
                "
              />
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
              Here's what LifeOS
              understood.
            </h1>

            <p
              className="
                mt-3
                max-w-3xl
                text-sm
                leading-relaxed
                text-muted-foreground
              "
            >
              Review the information
              extracted from your input
              before LifeOS turns it into
              tasks, priorities, and a
              realistic execution plan.
            </p>

            <div
              className="
                mt-4
                flex
                flex-wrap
                items-center
                gap-3
              "
            >
              <span
                className="
                  rounded-full
                  border
                  border-white/[0.08]
                  bg-white/[0.03]
                  px-3
                  py-1
                  font-mono
                  text-[10px]
                  uppercase
                  tracking-widest
                  text-muted-foreground/60
                "
              >
                Engine:{" "}
                {data.engine ??
                  "unknown"}
              </span>

              <span
                className="
                  rounded-full
                  border
                  border-primary/[0.12]
                  bg-primary/[0.04]
                  px-3
                  py-1
                  font-mono
                  text-[10px]
                  uppercase
                  tracking-widest
                  text-primary/70
                "
              >
                AI interpretation
              </span>
            </div>
          </div>
        </header>

        {/* ========================================================= */}
        {/* EXTRACTION GRID                                            */}
        {/* ========================================================= */}

        <div
          className="
            grid
            gap-6
            lg:grid-cols-2
          "
        >

          {/* ======================================================= */}
          {/* GOALS                                                     */}
          {/* ======================================================= */}

          <section
            className="
              group
              relative
              overflow-hidden
              rounded-3xl
              border
              border-white/[0.08]
              bg-black/20
              p-6
              backdrop-blur-2xl
              shadow-[0_20px_70px_rgba(0,0,0,0.3)]
              transition-all
              duration-300
              hover:border-white/[0.13]
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
                bg-primary/[0.035]
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
              <div
                className="
                  flex
                  items-center
                  gap-3
                "
              >
                <div
                  className="
                    flex
                    h-9
                    w-9
                    items-center
                    justify-center
                    rounded-xl
                    border
                    border-primary/15
                    bg-primary/[0.05]
                  "
                >
                  <Target
                    className="
                      h-4
                      w-4
                      text-primary
                    "
                  />
                </div>

                <div>
                  <h2 className="text-base font-semibold">
                    Goals
                  </h2>

                  <p
                    className="
                      mt-0.5
                      text-[10px]
                      uppercase
                      tracking-widest
                      text-muted-foreground/50
                    "
                  >
                    Detected objectives
                  </p>
                </div>
              </div>

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
                {extraction.goals.length}
              </span>
            </div>

            <ul className="relative mt-4 space-y-2.5">
              {extraction.goals.map(
                (g) => (
                  <li
                    key={g.title}
                    className="
                      rounded-2xl
                      border
                      border-white/[0.07]
                      bg-white/[0.02]
                      p-4
                      transition-all
                      hover:border-primary/20
                      hover:bg-white/[0.035]
                    "
                  >
                    <p
                      className="
                        text-sm
                        font-medium
                        text-foreground/90
                      "
                    >
                      {g.title}
                    </p>

                    <p
                      className="
                        mt-2
                        text-xs
                        leading-relaxed
                        text-muted-foreground
                      "
                    >
                      importance{" "}
                      <span className="text-foreground/70">
                        {g.importance}
                      </span>{" "}
                      ·{" "}
                      {g.deadline_text ||
                        "no stated timing"}{" "}
                      ·{" "}
                      <span
                        className={
                          CERTAINTY_STYLE[
                            g.certainty
                          ]
                        }
                      >
                        {g.certainty}
                      </span>
                    </p>
                  </li>
                ),
              )}

              {extraction.goals
                .length === 0 && (
                <li
                  className="
                    rounded-2xl
                    border
                    border-dashed
                    border-white/[0.08]
                    p-5
                    text-center
                    text-sm
                    text-muted-foreground
                  "
                >
                  No explicit goals found.
                </li>
              )}
            </ul>
          </section>

          {/* ======================================================= */}
          {/* TASKS                                                     */}
          {/* ======================================================= */}

          <section
            className="
              group
              relative
              overflow-hidden
              rounded-3xl
              border
              border-white/[0.08]
              bg-black/20
              p-6
              backdrop-blur-2xl
              shadow-[0_20px_70px_rgba(0,0,0,0.3)]
              transition-all
              duration-300
              hover:border-white/[0.13]
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
                bg-primary/[0.035]
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
              <div
                className="
                  flex
                  items-center
                  gap-3
                "
              >
                <div
                  className="
                    flex
                    h-9
                    w-9
                    items-center
                    justify-center
                    rounded-xl
                    border
                    border-primary/15
                    bg-primary/[0.05]
                  "
                >
                  <ListChecks
                    className="
                      h-4
                      w-4
                      text-primary
                    "
                  />
                </div>

                <div>
                  <h2 className="text-base font-semibold">
                    Tasks
                  </h2>

                  <p
                    className="
                      mt-0.5
                      text-[10px]
                      uppercase
                      tracking-widest
                      text-muted-foreground/50
                    "
                  >
                    Extracted work
                  </p>
                </div>
              </div>

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
                {extraction.tasks.length}
              </span>
            </div>

            <ul className="relative mt-4 space-y-2.5">
              {extraction.tasks.map(
                (t) => (
                  <li
                    key={t.title}
                    className="
                      rounded-2xl
                      border
                      border-white/[0.07]
                      bg-white/[0.02]
                      p-4
                      transition-all
                      hover:border-primary/20
                      hover:bg-white/[0.035]
                    "
                  >
                    <div className="flex items-start justify-between gap-4">
                      <p
                        className="
                          text-sm
                          font-medium
                          text-foreground/90
                        "
                      >
                        {t.title}
                      </p>

                      <span
                        className="
                          shrink-0
                          font-mono
                          text-[10px]
                          text-primary/70
                        "
                      >
                        {t.progress}%
                      </span>
                    </div>

                    <div
                      className="
                        mt-3
                        h-1
                        overflow-hidden
                        rounded-full
                        bg-white/[0.06]
                      "
                    >
                      <div
                        className="
                          h-full
                          rounded-full
                          bg-primary/70
                          shadow-[0_0_10px_rgba(34,211,238,0.35)]
                        "
                        style={{
                          width: `${Math.min(
                            100,
                            Math.max(
                              0,
                              t.progress,
                            ),
                          )}%`,
                        }}
                      />
                    </div>

                    <p
                      className="
                        mt-3
                        text-xs
                        leading-relaxed
                        text-muted-foreground
                      "
                    >
                      {formatMinutesLabel(
                        t.estimated_minutes,
                      )}{" "}
                      · importance{" "}
                      {t.importance}{" "}
                      · urgency{" "}
                      {t.urgency}{" "}
                      ·{" "}
                      <span
                        className={
                          CERTAINTY_STYLE[
                            t.certainty
                          ]
                        }
                      >
                        {t.certainty}
                      </span>
                    </p>

                    {t.deadline_text && (
                      <p
                        className="
                          mt-1.5
                          flex
                          items-center
                          gap-1.5
                          text-xs
                          text-muted-foreground
                        "
                      >
                        <CalendarClock className="h-3 w-3" />

                        due:{" "}
                        {t.deadline_text}
                      </p>
                    )}
                  </li>
                ),
              )}

              {extraction.tasks
                .length === 0 && (
                <li
                  className="
                    rounded-2xl
                    border
                    border-dashed
                    border-white/[0.08]
                    p-5
                    text-center
                    text-sm
                    text-muted-foreground
                  "
                >
                  No tasks found.
                </li>
              )}
            </ul>
          </section>

          {/* ======================================================= */}
          {/* DEADLINES                                                  */}
          {/* ======================================================= */}

          <section
            className="
              relative
              overflow-hidden
              rounded-3xl
              border
              border-white/[0.08]
              bg-black/20
              p-6
              backdrop-blur-2xl
              shadow-[0_20px_70px_rgba(0,0,0,0.3)]
            "
          >
            <div
              className="
                pointer-events-none
                absolute
                -left-20
                -bottom-20
                h-40
                w-40
                rounded-full
                bg-primary/[0.03]
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
              <div
                className="
                  flex
                  items-center
                  gap-3
                "
              >
                <div
                  className="
                    flex
                    h-9
                    w-9
                    items-center
                    justify-center
                    rounded-xl
                    border
                    border-primary/15
                    bg-primary/[0.05]
                  "
                >
                  <CalendarClock
                    className="
                      h-4
                      w-4
                      text-primary
                    "
                  />
                </div>

                <div>
                  <h2 className="text-base font-semibold">
                    Deadlines
                  </h2>

                  <p
                    className="
                      mt-0.5
                      text-[10px]
                      uppercase
                      tracking-widest
                      text-muted-foreground/50
                    "
                  >
                    Time-sensitive items
                  </p>
                </div>
              </div>

              <span
                className="
                  font-mono
                  text-[10px]
                  text-muted-foreground
                "
              >
                {extraction.deadlines.length} detected
              </span>
            </div>

            <ul className="relative mt-4 space-y-2.5">
              {extraction.deadlines.map(
                (d) => (
                  <li
                    key={d.title}
                    className="
                      flex
                      items-center
                      justify-between
                      gap-4
                      rounded-2xl
                      border
                      border-white/[0.07]
                      bg-white/[0.02]
                      p-4
                    "
                  >
                    <span
                      className="
                        min-w-0
                        truncate
                        text-sm
                        font-medium
                        text-foreground/90
                      "
                    >
                      {d.title}
                    </span>

                    <span
                      className="
                        shrink-0
                        rounded-lg
                        border
                        border-white/[0.07]
                        bg-white/[0.03]
                        px-2.5
                        py-1
                        text-xs
                        text-muted-foreground
                      "
                    >
                      {d.due_text ||
                        d.due_at ||
                        "timing unclear"}
                    </span>
                  </li>
                ),
              )}

              {extraction.deadlines
                .length === 0 && (
                <li
                  className="
                    rounded-2xl
                    border
                    border-dashed
                    border-white/[0.08]
                    p-5
                    text-center
                    text-sm
                    text-muted-foreground
                  "
                >
                  No deadlines detected.
                </li>
              )}
            </ul>
          </section>

          {/* ======================================================= */}
          {/* CONSTRAINTS + TIME                                        */}
          {/* ======================================================= */}

          <section
            className="
              relative
              overflow-hidden
              rounded-3xl
              border
              border-white/[0.08]
              bg-black/20
              p-6
              backdrop-blur-2xl
              shadow-[0_20px_70px_rgba(0,0,0,0.3)]
            "
          >
            <div
              className="
                pointer-events-none
                absolute
                -right-20
                -bottom-20
                h-40
                w-40
                rounded-full
                bg-primary/[0.03]
                blur-3xl
              "
            />

            <div
              className="
                relative
                flex
                items-center
                gap-3
                border-b
                border-white/[0.07]
                pb-4
              "
            >
              <div
                className="
                  flex
                  h-9
                  w-9
                  items-center
                  justify-center
                  rounded-xl
                  border
                  border-primary/15
                  bg-primary/[0.05]
                "
              >
                <Clock3
                  className="
                    h-4
                    w-4
                    text-primary
                  "
                />
              </div>

              <div>
                <h2 className="text-base font-semibold">
                  Constraints & time
                </h2>

                <p
                  className="
                    mt-0.5
                    text-[10px]
                    uppercase
                    tracking-widest
                    text-muted-foreground/50
                  "
                >
                  Available resources
                </p>
              </div>
            </div>

            <ul
              className="
                relative
                mt-4
                space-y-2.5
              "
            >
              {extraction.constraints.map(
                (c) => (
                  <li
                    key={c}
                    className="
                      flex
                      gap-3
                      rounded-2xl
                      border
                      border-white/[0.06]
                      bg-white/[0.02]
                      p-3.5
                      text-sm
                      text-muted-foreground
                    "
                  >
                    <HelpCircle
                      className="
                        mt-0.5
                        h-4
                        w-4
                        shrink-0
                        text-[color:var(--color-warning)]
                      "
                    />

                    <span>{c}</span>
                  </li>
                ),
              )}

              {extraction.available_time.map(
                (a) => (
                  <li
                    key={a.label}
                    className="
                      flex
                      items-center
                      justify-between
                      gap-3
                      rounded-2xl
                      border
                      border-primary/[0.10]
                      bg-primary/[0.025]
                      p-3.5
                      text-sm
                    "
                  >
                    <span
                      className="
                        flex
                        items-center
                        gap-2.5
                        text-foreground/80
                      "
                    >
                      <CheckCircle2
                        className="
                          h-4
                          w-4
                          shrink-0
                          text-[color:var(--color-success)]
                        "
                      />

                      {a.label}
                    </span>

                    <span
                      className="
                        shrink-0
                        font-mono
                        text-xs
                        text-primary
                      "
                    >
                      {formatMinutesLabel(
                        a.minutes,
                      )}
                    </span>
                  </li>
                ),
              )}

              {extraction.constraints
                .length === 0 &&
                extraction.available_time
                  .length === 0 && (
                  <li
                    className="
                      rounded-2xl
                      border
                      border-dashed
                      border-white/[0.08]
                      p-5
                      text-center
                      text-sm
                      text-muted-foreground
                    "
                  >
                    Nothing stated about
                    your constraints.
                  </li>
                )}
            </ul>
          </section>
        </div>

        {/* ========================================================= */}
        {/* PLAN CONFIGURATION                                         */}
        {/* ========================================================= */}

        <section
          className="
            relative
            overflow-hidden
            rounded-3xl
            border
            border-primary/[0.12]
            bg-black/25
            p-6
            backdrop-blur-2xl
            shadow-[0_25px_100px_rgba(0,0,0,0.45)]
          "
        >
          {/* Glow */}

          <div
            className="
              pointer-events-none
              absolute
              -right-32
              -top-32
              h-72
              w-72
              rounded-full
              bg-primary/[0.04]
              blur-3xl
            "
          />

          <div
            className="
              relative
              flex
              flex-col
              gap-6
              lg:flex-row
              lg:items-end
              lg:justify-between
            "
          >
            <div className="max-w-xl">
              <div
                className="
                  flex
                  items-center
                  gap-2
                  text-primary
                "
              >
                <Sparkles className="h-4 w-4" />

                <span className="label-caps">
                  Planning Engine
                </span>
              </div>

              <h2
                className="
                  mt-2
                  text-xl
                  font-semibold
                "
              >
                Ready to turn context
                into action?
              </h2>

              <p
                className="
                  mt-2
                  text-sm
                  leading-relaxed
                  text-muted-foreground
                "
              >
                Tell LifeOS how much time
                you have available. It will
                use your priorities,
                deadlines, dependencies,
                and progress to construct
                the plan.
              </p>

              {/* Safety notice */}

              <div
                className="
                  mt-4
                  flex
                  items-start
                  gap-2.5
                  text-xs
                  text-muted-foreground/70
                "
              >
                <ShieldCheck
                  className="
                    mt-0.5
                    h-4
                    w-4
                    shrink-0
                    text-primary
                  "
                />

                Your extracted context
                remains reviewable before
                it affects your workspace.
              </div>
            </div>

            <div
              className="
                flex
                flex-wrap
                items-end
                gap-3
              "
            >
              <div className="w-44 space-y-2">
                <Label
                  htmlFor="minutes"
                  className="
                    text-xs
                    uppercase
                    tracking-widest
                    text-muted-foreground
                  "
                >
                  Time available
                </Label>

                <div className="relative">
                  <Input
                    id="minutes"
                    type="number"
                    min={15}
                    max={960}
                    value={minutes}
                    onChange={(e) =>
                      setMinutes(
                        e.target.value,
                      )
                    }
                    className="
                      h-11
                      border-white/[0.09]
                      bg-white/[0.03]
                      pr-14
                      font-mono
                      backdrop-blur-md
                      focus:border-primary/40
                    "
                  />

                  <span
                    className="
                      pointer-events-none
                      absolute
                      right-3
                      top-1/2
                      -translate-y-1/2
                      font-mono
                      text-[10px]
                      uppercase
                      tracking-wider
                      text-muted-foreground/50
                    "
                  >
                    min
                  </span>
                </div>
              </div>

              <Button
                size="lg"
                onClick={() =>
                  confirm.mutate()
                }
                disabled={
                  confirm.isPending
                }
                className="
                  h-11
                  border
                  border-primary/40
                  bg-primary/[0.08]
                  px-6
                  text-primary
                  shadow-[0_0_30px_rgba(34,211,238,0.08)]
                  transition-all
                  hover:border-primary/60
                  hover:bg-primary/[0.14]
                  hover:shadow-[0_0_40px_rgba(34,211,238,0.14)]
                "
              >
                {confirm.isPending ? (
                  <>
                    <Sparkles className="mr-2 h-4 w-4 animate-spin" />
                    Building your plan…
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    Confirm & build my plan
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>

              <Button
                variant="ghost"
                asChild
                className="
                  h-11
                  text-muted-foreground
                  hover:bg-white/[0.04]
                  hover:text-foreground
                "
              >
                <Link to="/capture">
                  Capture more
                </Link>
              </Button>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}