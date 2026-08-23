import type { FeedbackStatus, TaskFeedback } from "@/types/feedback";

const STORAGE_KEY = "lifeos.task-feedback.v1";
const MAX_ENTRIES = 100;
const STATUSES: FeedbackStatus[] = ["completed", "partial", "skipped"];

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function isFeedback(value: unknown): value is TaskFeedback {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v["taskIndex"] === "number" &&
    typeof v["taskTitle"] === "string" &&
    typeof v["estimatedMinutes"] === "number" &&
    typeof v["plannedMinutes"] === "number" &&
    typeof v["actualMinutes"] === "number" &&
    typeof v["timestamp"] === "string" &&
    STATUSES.includes(v["status"] as FeedbackStatus)
  );
}

/** Reads all stored feedback, newest first. Never throws. */
export function loadTaskFeedback(): TaskFeedback[] {
  if (!isBrowser()) return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isFeedback);
  } catch {
    return [];
  }
}

/** Appends one feedback entry (newest first). Returns the updated list. */
export function saveTaskFeedback(entry: TaskFeedback): TaskFeedback[] {
  if (!isBrowser()) return [];
  const next = [entry, ...loadTaskFeedback()].slice(0, MAX_ENTRIES);
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* storage full or unavailable — feedback is non-critical */
  }
  return next;
}

export function clearTaskFeedback(): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
