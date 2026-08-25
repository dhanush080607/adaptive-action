import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Sparkles, PlayCircle, ShieldCheck, Terminal, Cpu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { AmbientBackground, type AmbientState } from "@/components/lifeos/AmbientBackground";
import { AIOrb } from "@/components/lifeos/AIOrb";
import { ProcessingSteps, type StepState } from "@/components/lifeos/ProcessingSteps";
import { analyzeContext, loadDemoScenario } from "@/lib/lifeos/api.functions";

export const Route = createFileRoute("/_authenticated/capture")({
  head: () => ({
    meta: [
      { title: "Capture Information — LifeOS" },
      {
        name: "description",
        content:
          "Dump everything on your mind — deadlines, tasks, notes — and let LifeOS structure it.",
      },
      { property: "og:title", content: "Capture Information — LifeOS" },
      { property: "og:description", content: "Messy input in, structured context out." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
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
  const [aiState, setAiState] = useState<AmbientState>("IDLE");

  const analyze = useMutation({
    mutationFn: async () => {
      setAiState("ANALYZING");
      setStep(0);
      const timers = [1, 2, 3].map((i) => setTimeout(() => setStep(i), i * 900));
      try {
        return await analyzeFn({ data: { raw_input: text.trim() } });
      } finally {
        timers.forEach(clearTimeout);
      }
    },
    onSuccess: (result) => {
      setStep(STEP_LABELS.length);
      if (result.engine === "fallback" && result.notice) toast.warning(result.notice);
      else toast.success("Context parsed & understood");
      navigate({ to: "/context" });
    },
    onError: (e: Error) => {
      toast.error(e.message || "Could not analyze that input");
      setStep(-1);
    },
    onSettled: () => setAiState("IDLE"),
  });

  const steps = STEP_LABELS.map((label, i) => ({
    label,
    state: (step > i ? "done" : step === i ? "active" : "pending") as StepState,
  }));

  const loadDemo = async () => {
    const { raw_input } = await demoFn({ data: undefined });
    setText(raw_input);
    toast.success("Demo scenario loaded");
  };

  const charCount = text.trim().length;

  return (
    <>
      <AmbientBackground state={aiState} density="subtle" />

      <div className="relative z-10 grid gap-8 lg:grid-cols-[1.3fr_1fr] fade-in">
        {/* Main Input Column */}
        <section className="space-y-6">
          <header className="space-y-1.5 border-b border-border/40 pb-5">
            <span className="label-caps flex items-center gap-1.5 text-primary">
              <Terminal className="h-3.5 w-3.5" /> Intelligence Engine
            </span>
            <h1 className="text-3xl font-semibold text-gradient tracking-tight">
              Feed LifeOS your unstructured context.
            </h1>
            <p className="max-w-xl text-sm leading-relaxed text-muted-foreground">
              Write it naturally—deadlines, half-finished code, upcoming exams, or free time tonight.
              LifeOS will parse, extract entities, and map dependencies into a clean execution plan.
            </p>
          </header>

          {/* Glassmorphic Input Area */}
          <div className="group relative rounded-2xl border border-border/60 bg-surface/80 backdrop-blur-md transition-all focus-within:border-primary/50 focus-within:shadow-glow-cyan/20">
            <Textarea
              className="min-h-64 w-full border-0 bg-transparent p-5 font-mono text-sm leading-relaxed text-foreground placeholder:text-dim focus-visible:ring-0 focus-visible:outline-none resize-none"
              placeholder={
                "I have an ML exam Friday. I still haven't started chapters 3 and 4...\nThe web dev assignment is due tomorrow and it's 60% done.\nI have about 3 hours tonight."
              }
              value={text}
              onChange={(e) => setText(e.target.value)}
            />

            {/* Bottom Status Bar inside Input Box */}
            <div className="flex items-center justify-between border-t border-border/40 px-5 py-3 bg-background/40 rounded-b-2xl">
              <span className="font-mono text-xs text-muted-foreground">
                <span className={charCount >= 8 ? "text-primary font-medium" : ""}>{charCount}</span> characters
              </span>
              <span className="text-xs text-dim font-mono">
                {charCount < 8 ? "Min 8 characters required" : "Ready for extraction"}
              </span>
            </div>
          </div>

          {/* Action Bar */}
          <div className="flex flex-wrap items-center gap-3">
            <Button
              size="lg"
              disabled={charCount < 8 || analyze.isPending}
              onClick={() => analyze.mutate()}
              className="border-primary/40 bg-primary/10 text-primary hover:bg-primary/20 hover:border-primary/60 transition-all shadow-glow-cyan/30 px-6 font-medium"
            >
              <Sparkles className={`mr-2 h-4 w-4 ${analyze.isPending ? "animate-spin text-primary" : "text-primary"}`} />
              {analyze.isPending ? "Parsing Context…" : "Process Context"}
            </Button>

            <Button
              variant="secondary"
              onClick={loadDemo}
              disabled={analyze.isPending}
              className="border border-border/60 bg-surface hover:bg-surface-elevated hover:border-border transition-all text-foreground/90"
            >
              <PlayCircle className="mr-2 h-4 w-4 text-muted-foreground" />
              Load Demo Input
            </Button>
          </div>
        </section>

        {/* Sidebar Context Engine Monitor */}
        <aside className="panel focal-panel h-fit p-6 space-y-6">
          <div className="flex items-center gap-4 border-b border-border/30 pb-4">
            <AIOrb state={aiState} size={64} />
            <div>
              <span className="label-caps flex items-center gap-1">
                <Cpu className="h-3 w-3 text-primary" /> Context Engine
              </span>
              <p className="mt-0.5 text-sm font-medium text-foreground">
                {analyze.isPending ? "Analyzing semantic structures..." : "Awaiting input stream"}
              </p>
            </div>
          </div>

          {/* Processing Pipeline Steps */}
          <div className="space-y-3">
            <p className="text-xs font-semibold label-caps text-muted-foreground">Pipeline Telemetry</p>
            <ProcessingSteps steps={steps} />
          </div>

          {/* Safe AI Policy Notice */}
          <div className="rounded-xl border border-border/40 bg-background/40 p-3.5 backdrop-blur-sm flex items-start gap-2.5">
            <ShieldCheck className="h-4 w-4 text-primary shrink-0 mt-0.5" />
            <p className="text-xs text-muted-foreground leading-normal">
              LifeOS operates deterministically and never fabricates facts. Any unverified parameters are flagged on review.
            </p>
          </div>
        </aside>
      </div>
    </>
  );
}