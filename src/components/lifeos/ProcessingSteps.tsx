import { Check, Loader2 } from "lucide-react";

export type StepState = "done" | "active" | "pending";

export function ProcessingSteps({ steps }: { steps: { label: string; state: StepState }[] }) {
  return (
    <ul className="space-y-3" aria-live="polite">
      {steps.map((s) => (
        <li key={s.label} className="flex items-center gap-3 text-sm">
          <span className="flex h-5 w-5 items-center justify-center">
            {s.state === "done" ? (
              <Check className="h-4 w-4 text-[color:var(--color-success)]" />
            ) : s.state === "active" ? (
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
            ) : (
              <span className="h-2 w-2 rounded-full bg-muted-foreground/40" />
            )}
          </span>
          <span
            className={
              s.state === "pending"
                ? "text-muted-foreground"
                : s.state === "active"
                  ? "text-foreground"
                  : "text-muted-foreground line-through decoration-border"
            }
          >
            {s.label}
          </span>
        </li>
      ))}
    </ul>
  );
}
