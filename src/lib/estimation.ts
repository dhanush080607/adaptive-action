import type { TaskFeedback } from "@/types/feedback";

export interface EstimationAccuracy {
  estimatedMinutes: number;
  actualMinutes: number;
  /** actual - estimated (positive = took longer than estimated). */
  differenceMinutes: number;
  /** 0-100, 100 = perfect estimate. */
  accuracyPercentage: number;
  verdict: "accurate" | "underestimated" | "overestimated" | "unknown";
}

/** Deterministic comparison of an estimate against the real duration. */
export function compareEstimate(estimatedMinutes: number, actualMinutes: number): EstimationAccuracy {
  const est = Number.isFinite(estimatedMinutes) ? Math.max(0, estimatedMinutes) : 0;
  const act = Number.isFinite(actualMinutes) ? Math.max(0, actualMinutes) : 0;
  const differenceMinutes = act - est;

  if (est <= 0 || act <= 0) {
    return {
      estimatedMinutes: est,
      actualMinutes: act,
      differenceMinutes,
      accuracyPercentage: 0,
      verdict: "unknown",
    };
  }

  const ratio = Math.abs(differenceMinutes) / est;
  const accuracyPercentage = Math.max(0, Math.round((1 - ratio) * 100));
  const verdict =
    ratio <= 0.1 ? "accurate" : differenceMinutes > 0 ? "underestimated" : "overestimated";

  return { estimatedMinutes: est, actualMinutes: act, differenceMinutes, accuracyPercentage, verdict };
}

/**
 * Conservative estimate adjustment from past feedback.
 * Only reacts to >= 2 completed/partial entries for the same task title, caps the
 * multiplier at 1.5x, never shrinks an estimate below 0.9x, and rounds to 5 min.
 */
export function adjustedEstimateMinutes(
  taskTitle: string,
  estimatedMinutes: number,
  history: TaskFeedback[],
): number {
  const key = taskTitle.trim().toLowerCase();
  const samples = history.filter(
    (f) =>
      f.taskTitle.trim().toLowerCase() === key &&
      f.status !== "skipped" &&
      f.actualMinutes > 0 &&
      f.estimatedMinutes > 0,
  );
  if (samples.length < 2 || estimatedMinutes <= 0) return estimatedMinutes;

  const meanRatio =
    samples.reduce((sum, f) => sum + f.actualMinutes / f.estimatedMinutes, 0) / samples.length;
  // Damp the signal: move only halfway toward the observed ratio.
  const damped = 1 + (meanRatio - 1) * 0.5;
  const clamped = Math.min(1.5, Math.max(0.9, damped));
  const adjusted = Math.round((estimatedMinutes * clamped) / 5) * 5;
  return Math.min(600, Math.max(5, adjusted));
}

/** Aggregate accuracy across feedback history, or null when there is no usable data. */
export function overallEstimateAccuracy(history: TaskFeedback[]): number | null {
  const usable = history.filter((f) => f.estimatedMinutes > 0 && f.actualMinutes > 0);
  if (usable.length === 0) return null;
  const total = usable.reduce(
    (sum, f) => sum + compareEstimate(f.estimatedMinutes, f.actualMinutes).accuracyPercentage,
    0,
  );
  return Math.round(total / usable.length);
}
