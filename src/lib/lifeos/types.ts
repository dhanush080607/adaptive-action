import { z } from "zod";

export const PriorityLevels = ["CRITICAL", "HIGH", "MEDIUM", "LOW"] as const;
export type PriorityLevel = (typeof PriorityLevels)[number];

export const TaskStatuses = [
  "pending",
  "in_progress",
  "completed",
  "delayed",
  "blocked",
  "cancelled",
] as const;
export type TaskStatus = (typeof TaskStatuses)[number];

export const FeedbackKinds = [
  "completed",
  "partial",
  "delayed",
  "skipped",
  "blocked",
  "not_relevant",
  "took_longer",
] as const;
export type FeedbackKind = (typeof FeedbackKinds)[number];

/** Structured Context Engine output — validated on every AI response. */
export const extractedGoalSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional().default(""),
  importance: z.number().min(1).max(5).optional().default(3),
  deadline_text: z.string().optional().default(""),
  certainty: z.enum(["explicit", "inferred", "uncertain"]).optional().default("explicit"),
});

export const extractedTaskSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional().default(""),
  goal_title: z.string().optional().default(""),
  importance: z.number().min(1).max(5).optional().default(3),
  urgency: z.number().min(1).max(5).optional().default(3),
  estimated_minutes: z.number().min(5).max(600).optional().default(45),
  progress: z.number().min(0).max(100).optional().default(0),
  status: z.enum(["pending", "in_progress", "completed", "blocked"]).optional().default("pending"),
  deadline_text: z.string().optional().default(""),
  depends_on_titles: z.array(z.string()).optional().default([]),
  certainty: z.enum(["explicit", "inferred", "uncertain"]).optional().default("explicit"),
});

export const extractedDeadlineSchema = z.object({
  title: z.string().min(1),
  due_at: z.string().optional().default(""),
  due_text: z.string().optional().default(""),
  importance: z.number().min(1).max(5).optional().default(3),
  related_task_title: z.string().optional().default(""),
});

export const contextExtractionSchema = z.object({
  context_summary: z.string().default(""),
  goals: z.array(extractedGoalSchema).default([]),
  tasks: z.array(extractedTaskSchema).default([]),
  deadlines: z.array(extractedDeadlineSchema).default([]),
  constraints: z.array(z.string()).default([]),
  available_time: z
    .array(z.object({ label: z.string(), minutes: z.number().min(0).max(1440) }))
    .default([]),
  dependencies: z.array(z.object({ task: z.string(), depends_on: z.string() })).default([]),
  progress: z
    .array(z.object({ task: z.string(), percent: z.number().min(0).max(100) }))
    .default([]),
  open_questions: z.array(z.string()).default([]),
});

export type ContextExtraction = z.infer<typeof contextExtractionSchema>;
export type ExtractedTask = z.infer<typeof extractedTaskSchema>;

export const evaluationSchema = z.object({
  outcome: z.string(),
  changes: z.array(z.string()).default([]),
  affected_tasks: z.array(z.string()).default([]),
  should_replan: z.boolean(),
  reason: z.string(),
});
export type Evaluation = z.infer<typeof evaluationSchema>;

export type PlanItemDraft = {
  kind: "task" | "break";
  task_id: string | null;
  title: string;
  start_at: string;
  end_at: string;
  estimated_minutes: number;
  priority: PriorityLevel;
  reason: string;
  position: number;
};

export type NextAction = {
  task_id: string;
  task: string;
  reason: string;
  factors: string[];
  estimated_minutes: number;
  priority: PriorityLevel;
  confidence: number;
} | null;
