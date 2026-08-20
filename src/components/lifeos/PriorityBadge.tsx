import { PRIORITY_STYLES } from "@/lib/lifeos/format";
import { cn } from "@/lib/utils";

export function PriorityBadge({ level, className }: { level: string; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-2 py-0.5 text-[0.7rem] font-semibold tracking-widest uppercase",
        PRIORITY_STYLES[level] ?? PRIORITY_STYLES.LOW,
        className,
      )}
    >
      {level}
    </span>
  );
}
