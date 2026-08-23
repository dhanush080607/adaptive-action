export type FeedbackStatus = "completed" | "partial" | "skipped";

export interface TaskFeedback {
  /** Position of the task in the plan/queue at the time of feedback (-1 when unknown). */
  taskIndex: number;
  taskTitle: string;
  estimatedMinutes: number;
  plannedMinutes: number;
  actualMinutes: number;
  status: FeedbackStatus;
  /** ISO timestamp. */
  timestamp: string;
}
