import { computePriority, isActionable, type PriorityResult, type ScorableTask } from "./priority";
import type { FeedbackKind, NextAction, PlanItemDraft, PriorityLevel } from "./types";

export type PlanResult = {
  items: PlanItemDraft[];
  deferred: { id: string; title: string; minutes: number }[];
  warnings: string[];
  summary: string;
  scheduledMinutes: number;
};

const BREAK_MINUTES = 10;

/**
 * Deterministic planner: never schedules more work than the available window.
 * Highest priority-score work is placed first; the rest is explicitly deferred.
 */
export function buildPlan(
  tasks: ScorableTask[],
  availableMinutes: number,
  startAt: Date,
): PlanResult {
  const ranked = tasks
    .filter((t) => isActionable(t, tasks))
    .map((t) => ({ task: t, p: computePriority(t, tasks, startAt) }))
    .sort((a, b) => b.p.score - a.p.score);

  const items: PlanItemDraft[] = [];
  const deferred: PlanResult["deferred"] = [];
  const warnings: string[] = [];

  let cursor = new Date(startAt);
  let used = 0;
  let placed = 0;
  let totalWorkload = 0;

  for (const { task, p } of ranked) {
    const remainingFactor = 1 - Math.min(task.progress, 95) / 100;
    const minutes = Math.max(10, Math.round(task.estimated_minutes * remainingFactor));
    totalWorkload += minutes;

    const needsBreak = placed > 0 && placed % 2 === 0;
    const breakCost = needsBreak ? BREAK_MINUTES : 0;

    if (used + minutes + breakCost > availableMinutes) {
      deferred.push({ id: task.id, title: task.title, minutes });
      continue;
    }

    if (needsBreak) {
      const bEnd = new Date(cursor.getTime() + BREAK_MINUTES * 60000);
      items.push({
        kind: "break",
        task_id: null,
        title: "Break",
        start_at: cursor.toISOString(),
        end_at: bEnd.toISOString(),
        estimated_minutes: BREAK_MINUTES,
        priority: "LOW",
        reason: "Short reset to protect focus quality",
        position: items.length,
      });
      cursor = bEnd;
      used += BREAK_MINUTES;
    }

    const end = new Date(cursor.getTime() + minutes * 60000);
    items.push({
      kind: "task",
      task_id: task.id,
      title: task.title,
      start_at: cursor.toISOString(),
      end_at: end.toISOString(),
      estimated_minutes: minutes,
      priority: p.level,
      reason: p.factors[0] ?? "Highest-impact remaining work",
      position: items.length,
    });
    cursor = end;
    used += minutes;
    placed += 1;
  }

  if (deferred.length > 0) {
    warnings.push(
      `${deferred.length} task(s) don't fit in your ${formatMinutes(availableMinutes)} window and were moved to your next session.`,
    );
  }
  if (totalWorkload > availableMinutes) {
    warnings.push(
      `Your remaining workload is about ${formatMinutes(totalWorkload)} but you only have ${formatMinutes(availableMinutes)}.`,
    );
  }
  if (ranked.length === 0) {
    warnings.push("No actionable tasks — everything is either done or blocked.");
  }

  const scheduled = items.filter((i) => i.kind === "task");
  const summary =
    scheduled.length === 0
      ? "Nothing could be scheduled yet."
      : `Scheduled ${scheduled.length} task(s) across ${formatMinutes(used)}${
          deferred.length ? `, deferring ${deferred.length} lower-impact item(s)` : ""
        }.`;

  return { items, deferred, warnings, summary, scheduledMinutes: used };
}

export function formatMinutes(m: number): string {
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r ? `${h}h ${r}m` : `${h}h`;
}

/** Next Action Engine — returns exactly one recommended action. */
export function selectNextAction(tasks: ScorableTask[], now = new Date()): NextAction {
  const ranked = tasks
    .filter((t) => isActionable(t, tasks))
    .map((t) => ({ t, p: computePriority(t, tasks, now) }))
    .sort((a, b) => b.p.score - a.p.score);

  if (ranked.length === 0) return null;
  const top = ranked[0];
  const second = ranked[1];
  const gap = second ? top.p.score - second.p.score : 25;
  const confidence = Math.min(0.98, 0.62 + gap / 100 + top.p.score / 500);

  return {
    task_id: top.t.id,
    task: top.t.title,
    reason: buildReason(top.p, top.t),
    factors: top.p.factors,
    estimated_minutes: Math.max(
      10,
      Math.round(top.t.estimated_minutes * (1 - Math.min(top.t.progress, 95) / 100)),
    ),
    priority: top.p.level,
    confidence: Number(confidence.toFixed(2)),
  };
}

function buildReason(p: PriorityResult, t: ScorableTask): string {
  if (p.factors.length === 0) return `${t.title} is currently your highest-scoring work.`;
  return p.factors.slice(0, 2).join(" and ") + ".";
}

export type LocalEvaluation = {
  outcome: string;
  changes: string[];
  affected_tasks: string[];
  should_replan: boolean;
  reason: string;
};

/** Deterministic evaluation used both standalone and as the AI fallback. */
export function evaluateFeedback(args: {
  kind: FeedbackKind;
  taskTitle: string;
  estimatedMinutes: number;
  actualMinutes?: number | null;
  note?: string | null;
}): LocalEvaluation {
  const { kind, taskTitle, estimatedMinutes, actualMinutes } = args;
  const over =
    actualMinutes && estimatedMinutes ? actualMinutes - estimatedMinutes : 0;
  const changes: string[] = [];
  let outcome = "";
  let should_replan = true;
  let reason = "";

  switch (kind) {
    case "completed":
      outcome = `${taskTitle} was completed.`;
      changes.push("Task marked complete", "Goal progress recalculated");
      reason = "Finishing work frees the rest of the session, so the plan is rebuilt.";
      break;
    case "partial":
      outcome = `${taskTitle} was partially completed.`;
      changes.push("Task progress increased", "Remaining effort re-estimated");
      reason = "Remaining effort changed, so the schedule needs to shift.";
      break;
    case "delayed":
      outcome = `${taskTitle} was delayed.`;
      changes.push("Task marked delayed", "Urgency increased");
      reason = "A delayed task competes with later work, so priorities were recalculated.";
      break;
    case "skipped":
      outcome = `${taskTitle} was skipped.`;
      changes.push("Task pushed to the next session");
      reason = "Skipped work must be re-placed against remaining time.";
      break;
    case "blocked":
      outcome = `${taskTitle} is blocked.`;
      changes.push("Task marked blocked", "Removed from actionable set");
      reason = "Blocked work cannot be next, so a new next action is required.";
      break;
    case "not_relevant":
      outcome = `${taskTitle} is no longer relevant.`;
      changes.push("Task cancelled");
      reason = "Cancelling work changes the remaining workload.";
      break;
    case "took_longer":
      outcome = `${taskTitle} took ${actualMinutes ?? "more"} minutes instead of ${estimatedMinutes}.`;
      changes.push(
        over > 0 ? `Available time reduced by about ${over} minutes` : "Actual duration recorded",
        "Estimates for similar work adjusted",
      );
      reason = "Your remaining time shrank, so today's workload must become realistic again.";
      break;
  }

  if (kind === "completed" && over <= 0) should_replan = true;

  return { outcome, changes, affected_tasks: [taskTitle], should_replan, reason };
}
