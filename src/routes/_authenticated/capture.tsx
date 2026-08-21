import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { AmbientBackground, type AmbientState } from "@/components/lifeos/AmbientBackground";
import { AIOrb } from "@/components/lifeos/AIOrb";
import { ProcessingSteps, type StepState } from "@/components/lifeos/ProcessingSteps";
import { analyzeContext, loadDemoScenario } from "@/lib/lifeos/api.functions";

export const Route = createFileRoute("/_authenticated/capture")({
  head: () => ({
    meta: [
      { title: "Capture information — LifeOS" },
      {
        name: "description",
        content:
          "Dump everything on your mind — deadlines, tasks, notes — and let LifeOS structure it.",
      },
      { property: "og:title", content: "Capture information — LifeOS" },
      { property: "og:description", content: "Messy input in, structured context out." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Capture,
});

const STEP_LABELS = [
  "Reading your input",
  "Extracting goals, tasks and deadlines",
  "Resolving dependencies and progress",
  "Scoring priorities",
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
      else toast.success("Context understood");
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

  return (
    <>
      <AmbientBackground state={aiState} density="subtle" />
      <div className="relative z-10 grid gap-8 lg:grid-cols-[1.3fr_1fr]">
        <section>
          <p className="label-caps">Capture</p>
          <h1 className="mt-2 text-3xl font-semibold">Give LifeOS your messy information.</h1>
          <p className="mt-2 max-w-xl text-sm text-muted-foreground">
            Write it exactly as you'd tell a friend. Deadlines, half-finished work, how much time you
            have tonight — LifeOS will structure it and show you what it understood before anything
            changes.
          </p>

          <Textarea
            className="mt-6 min-h-64 font-mono text-sm"
            placeholder={
              "I have an ML exam Friday. I still haven't started chapters 3 and 4...\nThe web dev assignment is due tomorrow and it's 60% done.\nI have about 3 hours tonight."
            }
            value={text}
            onChange={(e) => setText(e.target.value)}
          />

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button
              size="lg"
              disabled={text.trim().length < 8 || analyze.isPending}
              onClick={() => analyze.mutate()}
            >
              <Sparkles className="mr-1.5 h-4 w-4" />
              {analyze.isPending ? "Understanding…" : "Understand my context"}
            </Button>
            <Button variant="secondary" onClick={loadDemo} disabled={analyze.isPending}>
              Load demo scenario
            </Button>
            <span className="font-mono text-xs text-muted-foreground">
              {text.trim().length} chars
            </span>
          </div>
        </section>

        <aside className="panel h-fit p-6">
          <div className="flex items-center gap-4">
            <AIOrb state={aiState} size={72} />
            <div>
              <p className="label-caps">Context engine</p>
              <p className="text-sm text-muted-foreground">
                {analyze.isPending ? "Working through your input…" : "Waiting for input"}
              </p>
            </div>
          </div>
          <div className="mt-6">
            <ProcessingSteps steps={steps} />
          </div>
          <p className="mt-6 text-xs text-muted-foreground">
            LifeOS never invents facts. Anything it had to guess is flagged as inferred or uncertain
            on the review screen.
          </p>
        </aside>
      </div>
    </>
  );
}
