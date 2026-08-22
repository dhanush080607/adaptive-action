import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, Brain, CalendarClock, Gauge, RefreshCw, Sparkles, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AmbientBackground } from "@/components/lifeos/AmbientBackground";
import { AIOrb } from "@/components/lifeos/AIOrb";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "LifeOS — Turn information into action" },
      {
        name: "description",
        content:
          "LifeOS understands your goals, deadlines and workload — then tells you exactly what to do next, and adapts when reality changes.",
      },
      { property: "og:title", content: "LifeOS — Turn information into action" },
      {
        property: "og:description",
        content:
          "Give LifeOS your messy information. It tells you what matters and what to do next.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

const PIPELINE = [
  { label: "Messy information", icon: Brain },
  { label: "Context", icon: Sparkles },
  { label: "Priority", icon: Gauge },
  { label: "Plan", icon: CalendarClock },
  { label: "Next action", icon: Target },
  { label: "Feedback & adapt", icon: RefreshCw },
];

function useReveal() {
  const ref = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setVisible(true);
          obs.disconnect();
        }
      },
      { threshold: 0.2 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return { ref, visible };
}

function Section({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children: React.ReactNode;
}) {
  const { ref, visible } = useReveal();
  return (
    <section
      ref={ref}
      className={`mx-auto w-full max-w-5xl px-5 py-16 transition-all duration-700 sm:py-24 ${
        visible ? "translate-y-0 opacity-100 blur-0" : "translate-y-4 opacity-0 blur-sm"
      }`}
    >
      <p className="label-caps">{eyebrow}</p>
      <h2 className="mt-3 max-w-2xl text-3xl font-semibold sm:text-4xl">{title}</h2>
      <div className="mt-8">{children}</div>
    </section>
  );
}

function Landing() {
  return (
    <div className="relative min-h-screen">
      <AmbientBackground state="IDLE" />

      <div className="relative z-10">
        <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-6">
          <span className="text-lg font-semibold tracking-tight">
            Life<span className="text-primary">OS</span>
          </span>
          <nav className="flex items-center gap-2">
            <Button variant="ghost" asChild>
              <Link to="/auth">Sign in</Link>
            </Button>
            <Button asChild>
              <Link to="/auth" search={{ mode: "signup" } as never}>
                Get started
              </Link>
            </Button>
          </nav>
        </header>

        <main>
          <section className="mx-auto flex w-full max-w-6xl flex-col-reverse items-center gap-10 px-5 pt-10 pb-20 sm:pt-20 md:flex-row md:gap-16">
            <div className="rise-in flex-1">
              <p className="label-caps">AI Action System</p>
              <h1 className="mt-4 text-4xl leading-[1.05] font-semibold sm:text-6xl">
                <span className="text-gradient">Turn information into action.</span>
              </h1>
              <p className="mt-5 max-w-xl text-base text-muted-foreground sm:text-lg">
                LifeOS understands your goals, deadlines and workload — then tells you what to do
                next. When reality changes, it replans around you.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Button size="lg" asChild>
                  <Link to="/auth">
                    Get started <ArrowRight className="ml-1 h-4 w-4" />
                  </Link>
                </Button>
                <Button size="lg" variant="secondary" asChild>
                  <a href="#how-it-works">See how it works</a>
                </Button>
              </div>
              <p className="mt-6 font-mono text-xs text-muted-foreground">
                Capture → Understand → Prioritize → Plan → Next action → Adapt
              </p>
            </div>
            <div className="flex flex-1 items-center justify-center">
              <AIOrb state="UNDERSTANDING" size={260} />
            </div>
          </section>

          <Section
            eyebrow="The problem"
            title="You don't have an information problem. You have a decision problem."
          >
            <div className="grid gap-4 sm:grid-cols-3">
              {[
                {
                  t: "Everything is scattered",
                  d: "Notes, deadlines, study material, assignments and ideas live in different places.",
                },
                {
                  t: "Nothing is prioritized",
                  d: "A long list doesn't tell you which item actually matters right now.",
                },
                {
                  t: "Plans break instantly",
                  d: "One task running long invalidates the rest of your day — and nobody rebuilds it.",
                },
              ].map((c) => (
                <div key={c.t} className="panel p-5">
                  <h3 className="font-medium">{c.t}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{c.d}</p>
                </div>
              ))}
            </div>
          </Section>

          <div id="how-it-works">
            <Section
              eyebrow="How LifeOS works"
              title="One continuous loop, not a pile of features."
            >
              <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {PIPELINE.map((p, i) => (
                  <li key={p.label} className="panel flex items-start gap-4 p-5">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-primary/30 bg-primary/10 text-primary">
                      <p.icon className="h-5 w-5" />
                    </span>
                    <div>
                      <p className="font-mono text-xs text-muted-foreground">
                        {String(i + 1).padStart(2, "0")}
                      </p>
                      <p className="font-medium">{p.label}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </Section>
          </div>

          <Section
            eyebrow="Killer feature"
            title="What should I do next? LifeOS answers with exactly one action."
          >
            <div className="focal-panel p-6 sm:p-8">
              <p className="label-caps text-primary">Your next action</p>
              <h3 className="mt-3 text-2xl font-semibold sm:text-3xl">
                Complete Web Development Assignment
              </h3>
              <p className="mt-2 text-sm text-muted-foreground">
                HIGH PRIORITY · 40 minutes · confidence 92%
              </p>
              <div className="mt-5 rounded-lg border border-border/70 bg-background/40 p-4 text-sm">
                <p className="label-caps">Why this matters</p>
                <p className="mt-2">
                  The deadline is tomorrow and the assignment is already 60% complete — finishing it
                  removes a major obligation for only 40 minutes of work.
                </p>
              </div>
              <p className="mt-4 text-xs text-muted-foreground">
                Priority is computed deterministically from deadline pressure, importance, progress,
                dependencies and blocking impact — then explained in plain language.
              </p>
            </div>
          </Section>

          <Section
            eyebrow="Adaptive replanning"
            title="When reality changes, your plan changes with it."
          >
            <div className="grid gap-4 md:grid-cols-2">
              <div className="panel p-5">
                <p className="label-caps">Before</p>
                <ul className="mt-3 space-y-2 font-mono text-sm text-muted-foreground">
                  <li>6:00 Assignment</li>
                  <li>7:00 Chapter 3</li>
                  <li>8:00 Chapter 4</li>
                </ul>
              </div>
              <div className="panel border-primary/40 p-5">
                <p className="label-caps text-primary">After “the assignment took 90 minutes”</p>
                <ul className="mt-3 space-y-2 font-mono text-sm">
                  <li>6:00–7:30 Assignment</li>
                  <li>7:30–7:40 Break</li>
                  <li>7:40–8:20 Chapter 3</li>
                  <li className="text-muted-foreground">Chapter 4 → tomorrow</li>
                </ul>
              </div>
            </div>
          </Section>

          <section className="mx-auto w-full max-w-4xl px-5 pb-24 text-center">
            <h2 className="text-3xl font-semibold sm:text-4xl">
              Stop deciding what to do. Start doing it.
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
              Give LifeOS your messy information. It tells you what matters and what to do next.
            </p>
            <Button size="lg" className="mt-8" asChild>
              <Link to="/auth">
                Get started <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          </section>
        </main>

        <footer className="border-t border-border/60 py-8 text-center text-xs text-muted-foreground">
          LifeOS — AI Action System · Built for the AI Builders Hackathon
        </footer>
      </div>
    </div>
  );
}
