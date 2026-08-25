import { useEffect, useRef } from "react";
import { Check, Loader2 } from "lucide-react";
import { animate } from "animejs";

export type StepState = "done" | "active" | "pending";

type Step = {
  label: string;
  state: StepState;
};

export function ProcessingSteps({ steps }: { steps: Step[] }) {
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    if (!listRef.current) return;

    const items = Array.from(
      listRef.current.querySelectorAll("[data-processing-step]")
    );

    animate(items, {
      opacity: [0, 1],
      translateX: [-12, 0],
      delay: (_, index) => (index ?? 0) * 90,
      duration: 450,
      ease: "out(3)",
    });
  }, [steps]);

  return (
    <ul
      ref={listRef}
      className="space-y-3"
      aria-live="polite"
    >
      {steps.map((s) => (
        <li
          key={s.label}
          data-processing-step
          className={`group flex items-center gap-3 rounded-xl px-2 py-1.5 text-sm transition-all duration-300 ${
            s.state === "active"
              ? "bg-primary/5"
              : ""
          }`}
        >
          {/* Status icon */}
          <span
            className={`relative flex h-5 w-5 shrink-0 items-center justify-center transition-all duration-300 ${
              s.state === "active"
                ? "text-primary"
                : s.state === "done"
                  ? "text-[color:var(--color-success)]"
                  : "text-muted-foreground/40"
            }`}
          >
            {/* Active glow */}
            {s.state === "active" && (
              <span className="absolute inset-0 animate-ping rounded-full bg-primary/20" />
            )}

            <span className="relative z-10">
              {s.state === "done" ? (
                <Check className="h-4 w-4" />
              ) : s.state === "active" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <span className="block h-2 w-2 rounded-full bg-muted-foreground/40 transition-all duration-300 group-hover:scale-125" />
              )}
            </span>
          </span>

          {/* Label */}
          <span
            className={`transition-all duration-300 ${
              s.state === "pending"
                ? "text-muted-foreground"
                : s.state === "active"
                  ? "font-medium text-foreground"
                  : "text-muted-foreground line-through decoration-border"
            }`}
          >
            {s.label}
          </span>

          {/* Active indicator */}
          {s.state === "active" && (
            <span className="ml-auto flex items-center gap-1">
              <span className="h-1 w-1 animate-pulse rounded-full bg-primary" />

              <span
                className="h-1 w-1 animate-pulse rounded-full bg-primary"
                style={{ animationDelay: "120ms" }}
              />

              <span
                className="h-1 w-1 animate-pulse rounded-full bg-primary"
                style={{ animationDelay: "240ms" }}
              />
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}