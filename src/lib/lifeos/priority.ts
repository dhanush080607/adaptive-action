import type { PriorityLevel } from "./types";

export type ScorableTask = {
  id: string;
  title: string;
  status: string;
  importance: number;
  urgency: number;
  estimated_minutes: number;
  progress: number;
  deadline: string | null;
  goal_id: string | null;
  depends_on: string[];
};

export type PriorityResult = {
  score: number;
  level: PriorityLevel;
  factors: string[];
  blockedBy: string[];
};

const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

export function levelFor(score: number): PriorityLevel {
  if (score >= 78) return "CRITICAL";
  if (score >= 58) return "HIGH";
  if (score >= 36) return "MEDIUM";
  return "LOW";
}

export function hoursUntil(deadline: string | null, now: Date): number | null {
  if (!deadline) return null;
  const t = new Date(deadline).getTime();
  if (Number.isNaN(t)) return null;
  return (t - now.getTime()) / 3_600_000;
}

/**
 * Deterministic, explainable priority engine. AI never sets the score;
 * it only supplies importance/urgency/effort signals that feed this formula.
 */
export function computePriority(
  task: ScorableTask,
  allTasks: ScorableTask[],
  now = new Date(),
): PriorityResult {
  const factors: string[] = [];
  const hrs = hoursUntil(task.deadline, now);

  let deadlineScore = 4;
  if (hrs !== null) {
    if (hrs <= 0) {
      deadlineScore = 36;
      factors.push("Deadline has already passed");
    } else if (hrs <= 12) {
      deadlineScore = 35;
      factors.push("Deadline is within 12 hours");
    } else if (hrs <= 24) {
      deadlineScore = 30;
      factors.push("Deadline is tomorrow");
    } else if (hrs <= 48) {
      deadlineScore = 24;
      factors.push("Deadline is in under 2 days");
    } else if (hrs <= 72) {
      deadlineScore = 18;
      factors.push("Deadline is in under 3 days");
    } else if (hrs <= 168) {
      deadlineScore = 11;
      factors.push("Deadline is this week");
    } else {
      deadlineScore = 5;
    }
  }

  const importanceScore = clamp(task.importance, 1, 5) * 4;
  if (task.importance >= 4) factors.push("Marked as high importance");
  const urgencyScore = clamp(task.urgency, 1, 5) * 3;

  const blockedBy = task.depends_on.filter((id) => {
    const dep = allTasks.find((t) => t.id === id);
    return dep && dep.status !== "completed";
  });
  let dependencyScore = 0;
  if (blockedBy.length > 0) {
    dependencyScore = -22;
    factors.push("Waiting on an unfinished dependency");
  }

  const blockingCount = allTasks.filter(
    (t) => t.status !== "completed" && t.depends_on.includes(task.id),
  ).length;
  const blockingScore = clamp(blockingCount * 6, 0, 12);
  if (blockingCount > 0) factors.push(`Unblocks ${blockingCount} other task(s)`);

  const goalScore = task.goal_id ? 8 : 0;
  if (task.goal_id) factors.push("Directly advances one of your goals");

  let effortPenalty = 0;
  if (task.estimated_minutes > 150) effortPenalty = 9;
  else if (task.estimated_minutes > 90) effortPenalty = 5;
  else if (task.estimated_minutes <= 45) factors.push("Short enough to finish in one sitting");

  let progressBonus = 0;
  if (task.progress >= 80) {
    progressBonus = 12;
    factors.push(`Already ${task.progress}% complete — nearly done`);
  } else if (task.progress >= 40) {
    progressBonus = 8;
    factors.push(`Already ${task.progress}% complete`);
  }
  if (task.status === "in_progress") {
    progressBonus += 4;
    factors.push("Already in progress");
  }
  if (task.status === "delayed") {
    progressBonus += 3;
    factors.push("Was delayed earlier");
  }

  const raw =
    deadlineScore +
    importanceScore +
    urgencyScore +
    dependencyScore +
    blockingScore +
    goalScore +
    progressBonus -
    effortPenalty;

  const score = clamp(Math.round((raw / 96) * 100), 0, 100);
  return { score, level: levelFor(score), factors: factors.slice(0, 5), blockedBy };
}

export function isActionable(task: ScorableTask, all: ScorableTask[]): boolean {
  if (!["pending", "in_progress", "delayed"].includes(task.status)) return false;
  return computePriority(task, all).blockedBy.length === 0;
}
