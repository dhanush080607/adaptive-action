import { AnimatePresence, motion } from "framer-motion";
import { Coffee } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { PriorityBadge } from "./PriorityBadge";
import { formatClock, formatMinutesLabel } from "@/lib/lifeos/format";

export type TimelineItem = {
  id: string;
  kind: string;
  title: string;
  start_at: string;
  end_at: string;
  estimated_minutes: number;
  priority: string;
  reason: string | null;
  task_id: string | null;
};

export function PlanTimeline({
  items,
  highlightTaskId,
}: {
  items: TimelineItem[];
  highlightTaskId?: string | null;
}) {
  if (items.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No plan yet. Once LifeOS understands your context it will schedule your session here.
      </p>
    );
  }

  return (
    <ol className="relative space-y-2 border-l border-border/70 pl-5">
      <AnimatePresence initial={false}>
        {items.map((item) => (
          <motion.li
            key={item.id}
            layout
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, x: -12 }}
            transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
            className="relative"
          >
            <span
              className="absolute top-4 -left-[1.42rem] h-2.5 w-2.5 rounded-full border border-background"
              style={{
                backgroundColor:
                  item.kind === "break" ? "var(--color-muted-foreground)" : "var(--color-primary)",
              }}
            />
            <div
              className={`rounded-lg border p-3.5 transition-colors sm:p-4 ${
                highlightTaskId && item.task_id === highlightTaskId
                  ? "border-primary/60 bg-primary/8"
                  : "border-border/60 bg-[color:var(--color-surface)]/70 hover:border-border"
              }`}
            >
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="font-mono text-xs text-muted-foreground">
                  {formatClock(item.start_at)} – {formatClock(item.end_at)}
                </span>
                <span className="text-xs text-muted-foreground">
                  {formatMinutesLabel(item.estimated_minutes)}
                </span>
                {item.kind === "task" ? (
                  <PriorityBadge level={item.priority} className="ml-auto" />
                ) : (
                  <Coffee className="ml-auto h-3.5 w-3.5 text-muted-foreground" />
                )}
              </div>
              <p className="mt-1.5 font-medium">
                {item.task_id ? (
                  <Link
                    to="/tasks/$id"
                    params={{ id: item.task_id }}
                    className="hover:text-primary hover:underline"
                  >
                    {item.title}
                  </Link>
                ) : (
                  item.title
                )}
              </p>
              {item.reason && (
                <p className="mt-1 text-xs text-muted-foreground">{item.reason}</p>
              )}
            </div>
          </motion.li>
        ))}
      </AnimatePresence>
    </ol>
  );
}
