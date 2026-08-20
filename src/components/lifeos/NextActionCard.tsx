import { Link } from "@tanstack/react-router";
import { ArrowRight, Sparkles, Timer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PriorityBadge } from "./PriorityBadge";
import { formatMinutesLabel } from "@/lib/lifeos/format";
import type { NextAction } from "@/lib/lifeos/types";

export function NextActionCard({
  action,
  onStart,
  onFeedback,
  busy,
}: {
  action: NextAction;
  onStart?: () => void;
  onFeedback?: () => void;
  busy?: boolean;
}) {
  if (!action) {
    return (
      <section className="panel rise-in p-8">
        <p className="label-caps">Your next action</p>
        <h2 className="mt-3 text-2xl font-semibold">Nothing to do next — yet.</h2>
        <p className="mt-2 max-w-md text-sm text-muted-foreground">
          Capture what's on your mind and LifeOS will turn it into a prioritized plan with one clear
          next step.
        </p>
        <Button asChild className="mt-6">
          <Link to="/capture">Capture your information</Link>
        </Button>
      </section>
    );
  }

  return (
    <section className="focal-panel rise-in relative overflow-hidden p-6 sm:p-8" aria-labelledby="next-action-title">
      <div className="flex flex-wrap items-center gap-3">
        <p className="label-caps flex items-center gap-2 text-primary">
          <Sparkles className="h-3.5 w-3.5" /> Your next action
        </p>
        <PriorityBadge level={action.priority} />
        <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          <Timer className="h-3.5 w-3.5" /> {formatMinutesLabel(action.estimated_minutes)}
        </span>
        <span className="ml-auto font-mono text-xs text-muted-foreground">
          confidence {Math.round(action.confidence * 100)}%
        </span>
      </div>

      <h2 id="next-action-title" className="mt-4 text-3xl leading-tight font-semibold sm:text-4xl">
        {action.task}
      </h2>

      <div className="mt-5 rounded-lg border border-border/70 bg-background/40 p-4">
        <p className="label-caps">Why this matters</p>
        <p className="mt-2 text-sm text-foreground/90">{action.reason}</p>
        {action.factors.length > 0 && (
          <ul className="mt-3 space-y-1.5">
            {action.factors.map((f) => (
              <li key={f} className="flex gap-2 text-sm text-muted-foreground">
                <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-primary" />
                {f}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <Button size="lg" onClick={onStart} disabled={busy}>
          Start focus <ArrowRight className="ml-1 h-4 w-4" />
        </Button>
        <Button size="lg" variant="secondary" onClick={onFeedback} disabled={busy}>
          Give feedback
        </Button>
        <Button size="lg" variant="ghost" asChild>
          <Link to="/tasks/$id" params={{ id: action.task_id }}>
            Task details
          </Link>
        </Button>
      </div>
    </section>
  );
}
