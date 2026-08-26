import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import {
  Sparkles,
  PlayCircle,
  ShieldCheck,
  Terminal,
  Cpu,
  BrainCircuit,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

import {
  AmbientBackground,
  type AmbientState,
} from "@/components/lifeos/AmbientBackground";

import { AIOrb } from "@/components/lifeos/AIOrb";

import {
  ProcessingSteps,
  type StepState,
} from "@/components/lifeos/ProcessingSteps";

import {
  analyzeContext,
  loadDemoScenario,
} from "@/lib/lifeos/api.functions";

export const Route = createFileRoute("/_authenticated/capture")({
  head: () => ({
    meta: [
      {
        title: "Capture Information — LifeOS",
      },
      {
        name: "description",
        content:
          "Dump everything on your mind — deadlines, tasks, notes — and let LifeOS structure it.",
      },
      {
        property: "og:title",
        content: "Capture Information — LifeOS",
      },
      {
        property: "og:description",
        content: "Messy input in, structured context out.",
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

  component: Capture,
});

const STEP_LABELS = [
  "Reading your raw input",
  "Extracting goals, tasks and deadlines",
  "Resolving dependencies and progress",
  "Scoring relative priorities",
];

function Capture() {
  const navigate = useNavigate();

  const analyzeFn = useServerFn(analyzeContext);
  const demoFn = useServerFn(loadDemoScenario);

  const [text, setText] = useState("");
  const [step, setStep] = useState(-1);
  const [aiState, setAiState] =
    useState<AmbientState>("IDLE");

  const analyze = useMutation({
    mutationFn: async () => {
      setAiState("ANALYZING");
      setStep(0);

      const timers = [1, 2, 3].map((i) =>
        setTimeout(
          () => setStep(i),
          i * 900,
        ),
      );

      try {
        return await analyzeFn({
          data: {
            raw_input: text.trim(),
          },
        });
      } finally {
        timers.forEach(clearTimeout);
      }
    },

    onSuccess: (result) => {
      setStep(STEP_LABELS.length);

      if (
        result.engine === "fallback" &&
        result.notice
      ) {
        toast.warning(result.notice);
      } else {
        toast.success(
          "Context parsed & understood",
        );
      }

      navigate({
        to: "/context",
      });
    },

    onError: (e: Error) => {
      toast.error(
        e.message ||
          "Could not analyze that input",
      );

      setStep(-1);
    },

    onSettled: () => {
      setAiState("IDLE");
    },
  });

  const steps = STEP_LABELS.map(
    (label, i) => ({
      label,

      state: (
        step > i
          ? "done"
          : step === i
            ? "active"
            : "pending"
      ) as StepState,
    }),
  );

  const loadDemo = async () => {
    try {
      const { raw_input } =
        await demoFn({
          data: undefined,
        });

      setText(raw_input);

      toast.success(
        "Demo scenario loaded",
      );
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Could not load demo",
      );
    }
  };

  const charCount =
    text.trim().length;

  return (
    <div className="relative min-h-[calc(100vh-2rem)]">
      {/* ========================================================= */}
      {/* BLACK HOLE / AMBIENT BACKGROUND                          */}
      {/* ========================================================= */}

      <AmbientBackground
        state={aiState}
        density="subtle"
      />

      {/* ========================================================= */}
      {/* MAIN CONTENT                                              */}
      {/* ========================================================= */}

      <div className="relative z-10 grid gap-8 lg:grid-cols-[1.3fr_1fr] fade-in">

        {/* ===================================================== */}
        {/* LEFT SIDE                                             */}
        {/* ===================================================== */}

        <section className="space-y-6">

          {/* Header */}

          <header
            className="
              rounded-3xl
              border border-white/[0.08]
              bg-black/20
              backdrop-blur-xl
              px-7 py-6
              shadow-[0_20px_80px_rgba(0,0,0,0.35)]
            "
          >
            <span
              className="
                label-caps
                flex
                items-center
                gap-1.5
                text-primary
              "
            >
              <Terminal className="h-3.5 w-3.5" />

              Intelligence Engine

              <span
                className="
                  ml-1
                  h-1.5
                  w-1.5
                  rounded-full
                  bg-primary
                  shadow-[0_0_10px_currentColor]
                  animate-pulse
                "
              />
            </span>

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
              Feed LifeOS your
              <br />
              unstructured context.
            </h1>

            <p
              className="
                mt-3
                max-w-xl
                text-sm
                leading-relaxed
                text-muted-foreground
              "
            >
              Write it naturally —
              deadlines, half-finished
              code, upcoming exams, or
              free time tonight.
              LifeOS will parse,
              extract entities, and map
              dependencies into a clean
              execution plan.
            </p>
          </header>

          {/* ================================================= */}
          {/* GLASS INPUT                                       */}
          {/* ================================================= */}

          <div
            className="
              group
              relative
              overflow-hidden
              rounded-3xl
              border
              border-white/[0.10]
              bg-black/25
              backdrop-blur-2xl
              shadow-[0_25px_100px_rgba(0,0,0,0.45)]
              transition-all
              duration-300
              hover:border-white/[0.15]
              focus-within:border-primary/40
              focus-within:shadow-[0_0_50px_rgba(34,211,238,0.10)]
            "
          >

            {/* Subtle glass glow */}

            <div
              className="
                pointer-events-none
                absolute
                -top-32
                left-1/2
                h-64
                w-64
                -translate-x-1/2
                rounded-full
                bg-primary/[0.04]
                blur-3xl
              "
            />

            <Textarea
              className="
                relative
                min-h-72
                w-full
                resize-none
                border-0
                bg-transparent
                p-6
                font-mono
                text-sm
                leading-relaxed
                text-foreground
                placeholder:text-muted-foreground/40
                focus-visible:outline-none
                focus-visible:ring-0
              "
              placeholder={
                "I have an ML exam Friday. I still haven't started chapters 3 and 4...\n\nThe web dev assignment is due tomorrow and it's 60% done.\n\nI have about 3 hours tonight."
              }
              value={text}
              onChange={(e) =>
                setText(e.target.value)
              }
            />

            {/* Input status */}

            <div
              className="
                relative
                flex
                items-center
                justify-between
                border-t
                border-white/[0.07]
                bg-white/[0.015]
                px-6
                py-3.5
              "
            >
              <span
                className="
                  font-mono
                  text-xs
                  text-muted-foreground
                "
              >
                <span
                  className={
                    charCount >= 8
                      ? "font-medium text-primary"
                      : ""
                  }
                >
                  {charCount}
                </span>{" "}
                characters
              </span>

              <span
                className="
                  font-mono
                  text-xs
                  text-muted-foreground/60
                "
              >
                {charCount < 8
                  ? "Min 8 characters required"
                  : "● Ready for extraction"}
              </span>
            </div>
          </div>

          {/* ================================================= */}
          {/* ACTIONS                                           */}
          {/* ================================================= */}

          <div
            className="
              flex
              flex-wrap
              items-center
              gap-3
            "
          >
            <Button
              size="lg"
              disabled={
                charCount < 8 ||
                analyze.isPending
              }
              onClick={() =>
                analyze.mutate()
              }
              className="
                group
                border
                border-primary/40
                bg-primary/[0.08]
                px-7
                font-medium
                text-primary
                shadow-[0_0_30px_rgba(34,211,238,0.08)]
                transition-all
                duration-300
                hover:border-primary/60
                hover:bg-primary/[0.14]
                hover:shadow-[0_0_40px_rgba(34,211,238,0.15)]
              "
            >
              <Sparkles
                className={`
                  mr-2
                  h-4
                  w-4
                  ${
                    analyze.isPending
                      ? "animate-spin"
                      : "transition-transform group-hover:rotate-12"
                  }
                `}
              />

              {analyze.isPending
                ? "Parsing Context…"
                : "Process Context"}
            </Button>

            <Button
              variant="secondary"
              onClick={loadDemo}
              disabled={
                analyze.isPending
              }
              className="
                border
                border-white/[0.08]
                bg-white/[0.04]
                text-foreground/80
                backdrop-blur-xl
                transition-all
                duration-300
                hover:border-white/[0.15]
                hover:bg-white/[0.08]
              "
            >
              <PlayCircle
                className="
                  mr-2
                  h-4
                  w-4
                  text-muted-foreground
                "
              />

              Load Demo Input
            </Button>
          </div>

          {/* Small engine status */}

          <div
            className="
              flex
              items-center
              gap-2
              px-1
              text-[11px]
              font-mono
              uppercase
              tracking-widest
              text-muted-foreground/50
            "
          >
            <BrainCircuit className="h-3.5 w-3.5" />

            LifeOS Context Intelligence

            <span className="h-1 w-1 rounded-full bg-primary/70" />

            Semantic Processing
          </div>
        </section>

        {/* ===================================================== */}
        {/* RIGHT SIDE                                            */}
        {/* ===================================================== */}

        <aside
          className="
            relative
            h-fit
            overflow-hidden
            rounded-3xl
            border
            border-white/[0.09]
            bg-black/25
            p-6
            backdrop-blur-2xl
            shadow-[0_25px_100px_rgba(0,0,0,0.45)]
          "
        >

          {/* Ambient glow inside glass */}

          <div
            className="
              pointer-events-none
              absolute
              -right-24
              -top-24
              h-56
              w-56
              rounded-full
              bg-primary/[0.05]
              blur-3xl
            "
          />

          {/* ================================================= */}
          {/* ENGINE HEADER                                     */}
          {/* ================================================= */}

          <div
            className="
              relative
              flex
              items-center
              gap-4
              border-b
              border-white/[0.07]
              pb-5
            "
          >
            <div
              className="
                rounded-2xl
                border
                border-white/[0.08]
                bg-black/30
                p-1
                shadow-[0_0_30px_rgba(34,211,238,0.05)]
              "
            >
              <AIOrb
                state={aiState}
                size={64}
              />
            </div>

            <div>
              <span
                className="
                  label-caps
                  flex
                  items-center
                  gap-1.5
                "
              >
                <Cpu
                  className="
                    h-3
                    w-3
                    text-primary
                  "
                />

                Context Engine
              </span>

              <p
                className="
                  mt-1
                  text-sm
                  font-medium
                  text-foreground
                "
              >
                {analyze.isPending
                  ? "Analyzing semantic structures..."
                  : "Awaiting input stream"}
              </p>

              <div
                className="
                  mt-1.5
                  flex
                  items-center
                  gap-1.5
                  font-mono
                  text-[10px]
                  uppercase
                  tracking-wider
                  text-muted-foreground/50
                "
              >
                <span
                  className="
                    h-1.5
                    w-1.5
                    rounded-full
                    bg-primary
                    shadow-[0_0_8px_currentColor]
                  "
                />

                {analyze.isPending
                  ? "PROCESSING"
                  : "STANDBY"}
              </div>
            </div>
          </div>

          {/* ================================================= */}
          {/* PROCESSING PIPELINE                              */}
          {/* ================================================= */}

          <div
            className="
              relative
              mt-6
              space-y-4
            "
          >
            <div
              className="
                flex
                items-center
                justify-between
              "
            >
              <p
                className="
                  text-xs
                  font-semibold
                  uppercase
                  tracking-[0.18em]
                  text-muted-foreground/70
                "
              >
                Pipeline Telemetry
              </p>

              <span
                className="
                  font-mono
                  text-[10px]
                  text-primary/60
                "
              >
                {step < 0
                  ? "READY"
                  : `${Math.min(step, 4)}/4`}
              </span>
            </div>

            <div
              className="
                rounded-2xl
                border
                border-white/[0.06]
                bg-black/20
                p-4
              "
            >
              <ProcessingSteps
                steps={steps}
              />
            </div>
          </div>

          {/* ================================================= */}
          {/* SAFE AI NOTICE                                   */}
          {/* ================================================= */}

          <div
            className="
              relative
              mt-6
              flex
              items-start
              gap-3
              rounded-2xl
              border
              border-primary/[0.12]
              bg-primary/[0.025]
              p-4
              backdrop-blur-md
            "
          >
            <div
              className="
                mt-0.5
                rounded-lg
                border
                border-primary/20
                bg-primary/[0.07]
                p-1.5
              "
            >
              <ShieldCheck
                className="
                  h-4
                  w-4
                  text-primary
                "
              />
            </div>

            <div>
              <p
                className="
                  text-xs
                  font-medium
                  text-foreground/80
                "
              >
                Deterministic AI Policy
              </p>

              <p
                className="
                  mt-1
                  text-xs
                  leading-relaxed
                  text-muted-foreground
                "
              >
                LifeOS never fabricates
                facts. Unverified
                parameters are flagged
                for review before they
                influence your plan.
              </p>
            </div>
          </div>

          {/* Bottom telemetry */}

          <div
            className="
              relative
              mt-5
              flex
              items-center
              justify-between
              border-t
              border-white/[0.06]
              pt-4
              font-mono
              text-[9px]
              uppercase
              tracking-[0.16em]
              text-muted-foreground/40
            "
          >
            <span>
              LIFEOS // CONTEXT
            </span>

            <span>
              SECURE
            </span>
          </div>
        </aside>
      </div>
    </div>
  );
}