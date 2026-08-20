export function formatMinutesLabel(m: number): string {
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r ? `${h}h ${r}m` : `${h}h`;
}

export function formatClock(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

export function formatDue(iso: string | null): string {
  if (!iso) return "No deadline";
  const d = new Date(iso);
  const now = new Date();
  const diffDays = Math.round((d.getTime() - now.getTime()) / 86400000);
  const time = d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  if (diffDays < 0) return `Overdue — ${d.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;
  if (d.toDateString() === now.toDateString()) return `Today, ${time}`;
  if (diffDays <= 1) return `Tomorrow, ${time}`;
  if (diffDays <= 6) return `${d.toLocaleDateString(undefined, { weekday: "long" })}, ${time}`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function greeting(now = new Date()): string {
  const h = now.getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

export const PRIORITY_STYLES: Record<string, string> = {
  CRITICAL: "border-[color:var(--color-destructive)]/50 text-[color:var(--color-destructive)] bg-[color:var(--color-destructive)]/10",
  HIGH: "border-[color:var(--color-warning)]/50 text-[color:var(--color-warning)] bg-[color:var(--color-warning)]/10",
  MEDIUM: "border-primary/40 text-primary bg-primary/10",
  LOW: "border-border text-muted-foreground bg-muted/40",
};

export const STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  in_progress: "In progress",
  completed: "Completed",
  delayed: "Delayed",
  blocked: "Blocked",
  cancelled: "Cancelled",
};
