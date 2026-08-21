import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/integrations/supabase/types";
import { AiUnavailableError, generateStructured } from "./ai.server";
import { localExtractContext, resolveDatePhrase } from "./fallback";
import { buildPlan, evaluateFeedback, formatMinutes, selectNextAction } from "./planner";
import { computePriority, type ScorableTask } from "./priority";
import {
  contextExtractionSchema,
  evaluationSchema,
  type ContextExtraction,
  type Evaluation,
  type FeedbackKind,
} from "./types";

export type Sb = SupabaseClient<Database>;
export type TaskRow = Database["public"]["Tables"]["tasks"]["Row"];

export const toScorable = (t: TaskRow): ScorableTask => ({
  id: t.id,
  title: t.title,
  status: t.status,
  importance: t.importance,
  urgency: t.urgency,
  estimated_minutes: t.estimated_minutes,
  progress: t.progress,
  deadline: t.deadline,
  goal_id: t.goal_id,
  depends_on: t.depends_on ?? [],
});

export async function loadTasks(sb: Sb): Promise<TaskRow[]> {
  const { data, error } = await sb.from("tasks").select("*").order("created_at");
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function logEvent(sb: Sb, event_type: string, details: Record<string, unknown> = {}) {
  const { error } = await sb.from("activity_events").insert({ event_type, details: details as Json });
  if (error) console.error("[lifeos] activity log failed", error.message);
}

/* ---------------------------------- AI ---------------------------------- */

const CONTEXT_JSON_SCHEMA = {
  type: "object",
  properties: {
    context_summary: { type: "string" },
    goals: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          description: { type: "string" },
          importance: { type: "number" },
          deadline_text: { type: "string" },
          certainty: { type: "string", enum: ["explicit", "inferred", "uncertain"] },
        },
        required: ["title"],
      },
    },
    tasks: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          description: { type: "string" },
          goal_title: { type: "string" },
          importance: { type: "number" },
          urgency: { type: "number" },
          estimated_minutes: { type: "number" },
          progress: { type: "number" },
          status: { type: "string", enum: ["pending", "in_progress", "completed", "blocked"] },
          deadline_text: { type: "string" },
          depends_on_titles: { type: "array", items: { type: "string" } },
          certainty: { type: "string", enum: ["explicit", "inferred", "uncertain"] },
        },
        required: ["title"],
      },
    },
    deadlines: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          due_at: { type: "string" },
          due_text: { type: "string" },
          importance: { type: "number" },
          related_task_title: { type: "string" },
        },
        required: ["title"],
      },
    },
    constraints: { type: "array", items: { type: "string" } },
    available_time: {
      type: "array",
      items: {
        type: "object",
        properties: { label: { type: "string" }, minutes: { type: "number" } },
        required: ["label", "minutes"],
      },
    },
    dependencies: {
      type: "array",
      items: {
        type: "object",
        properties: { task: { type: "string" }, depends_on: { type: "string" } },
        required: ["task", "depends_on"],
      },
    },
    progress: {
      type: "array",
      items: {
        type: "object",
        properties: { task: { type: "string" }, percent: { type: "number" } },
        required: ["task", "percent"],
      },
    },
    open_questions: { type: "array", items: { type: "string" } },
  },
  required: ["context_summary", "goals", "tasks", "deadlines"],
};

export async function extractContext(
  raw: string,
  now: Date,
): Promise<{ extraction: ContextExtraction; engine: "ai" | "fallback"; notice?: string }> {
  const system = `You are the Context Engine of LifeOS, an AI action system for students.
Convert messy natural language into structured context. Rules:
- Only extract information that is present or reasonably implied. NEVER invent facts.
- Mark anything not clearly stated as "inferred" or "uncertain" in the certainty field.
- Break study material lists into one task per topic.
- estimated_minutes must be a realistic effort estimate for a student.
- importance and urgency are integers 1-5.
- progress is a percent 0-100; if the user says something is already done set status "completed" and progress 100.
- deadline_text should copy the user's own words for the timing (e.g. "Friday", "tomorrow").
- due_at must be an ISO-8601 timestamp when you can resolve it, otherwise empty string.
- available_time captures how much time the user says they have, in minutes.
- Put anything ambiguous in open_questions.
Current time is ${now.toISOString()} (UTC).`;

  try {
    const extraction = await generateStructured({
      schema: contextExtractionSchema,
      jsonSchema: CONTEXT_JSON_SCHEMA,
      schemaName: "life_context",
      system,
      user: raw,
    });
    return { extraction: contextExtractionSchema.parse(extraction), engine: "ai" };
  } catch (err) {
    const e = err as AiUnavailableError;
    console.error("[lifeos] context AI failed, using local fallback:", e.code ?? e.message);
    return {
      extraction: localExtractContext(raw, now),
      engine: "fallback",
      notice: "AI unavailable — used the local planning fallback.",
    };
  }
}

const EVAL_JSON_SCHEMA = {
  type: "object",
  properties: {
    outcome: { type: "string" },
    changes: { type: "array", items: { type: "string" } },
    affected_tasks: { type: "array", items: { type: "string" } },
    should_replan: { type: "boolean" },
    reason: { type: "string" },
  },
  required: ["outcome", "changes", "should_replan", "reason"],
};

export async function evaluate(args: {
  kind: FeedbackKind;
  taskTitle: string;
  estimatedMinutes: number;
  actualMinutes?: number | null;
  note?: string | null;
  openTasks: string[];
  availableMinutes: number;
}): Promise<{ evaluation: Evaluation; engine: "ai" | "fallback" }> {
  const local = evaluateFeedback(args);
  const system = `You are the Evaluation Engine of LifeOS. Given feedback on a task, explain in plain,
concise language what happened, what changed, which tasks are affected, and whether the day's plan
must be rebuilt. Never expose reasoning steps — only short decision factors. Never invent tasks.`;
  const user = `Task: ${args.taskTitle}
Feedback: ${args.kind}
Estimated minutes: ${args.estimatedMinutes}
Actual minutes: ${args.actualMinutes ?? "unknown"}
User note: ${args.note ?? "none"}
Remaining open tasks: ${args.openTasks.join(", ") || "none"}
Time available in this session: ${args.availableMinutes} minutes`;

  try {
    const evaluation = await generateStructured({
      schema: evaluationSchema,
      jsonSchema: EVAL_JSON_SCHEMA,
      schemaName: "evaluation",
      system,
      user,
    });
    return { evaluation: evaluationSchema.parse(evaluation), engine: "ai" };
  } catch (err) {
    console.error("[lifeos] evaluation AI failed, using deterministic evaluation");
    return { evaluation: local, engine: "fallback" };
  }
}

/* ------------------------- Context -> real records ------------------------ */

export async function applyExtraction(
  sb: Sb,
  extraction: ContextExtraction,
  now: Date,
): Promise<{ goals: number; tasks: number; deadlines: number }> {
  const goalIdByTitle = new Map<string, string>();

  const { data: existingGoals } = await sb.from("goals").select("id,title");
  for (const g of existingGoals ?? []) goalIdByTitle.set(g.title.toLowerCase(), g.id);

  for (const g of extraction.goals) {
    if (goalIdByTitle.has(g.title.toLowerCase())) continue;
    const { data, error } = await sb
      .from("goals")
      .insert({
        title: g.title,
        description: g.description || null,
        importance: Math.round(g.importance ?? 3),
        deadline: resolveDatePhrase(g.deadline_text ?? "", now),
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    goalIdByTitle.set(g.title.toLowerCase(), data.id);
  }

  const { data: existingTasks } = await sb.from("tasks").select("id,title");
  const existingTitles = new Set((existingTasks ?? []).map((t) => t.title.toLowerCase()));
  const insertedTaskIds = new Map<string, string>();

  for (const t of extraction.tasks) {
    if (existingTitles.has(t.title.toLowerCase())) continue;
    const goalId = t.goal_title ? goalIdByTitle.get(t.goal_title.toLowerCase()) ?? null : null;
    const deadline = resolveDatePhrase(t.deadline_text ?? "", now);
    const completed = t.status === "completed";
    const { data, error } = await sb
      .from("tasks")
      .insert({
        goal_id: goalId,
        title: t.title,
        description: t.description || null,
        status: completed ? "completed" : t.status ?? "pending",
        progress: completed ? 100 : Math.round(t.progress ?? 0),
        importance: Math.round(t.importance ?? 3),
        urgency: Math.round(t.urgency ?? 3),
        estimated_minutes: Math.round(t.estimated_minutes ?? 45),
        deadline,
        source: "context",
        reasoning: t.certainty === "explicit" ? "Stated directly in your input" : "Inferred from your input",
        completed_at: completed ? now.toISOString() : null,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    existingTitles.add(t.title.toLowerCase());
    insertedTaskIds.set(t.title.toLowerCase(), data.id);
  }

  // dependencies
  const { data: allTasks } = await sb.from("tasks").select("id,title");
  const idFor = (title: string) =>
    (allTasks ?? []).find((t) => t.title.toLowerCase() === title.toLowerCase())?.id ?? null;
  for (const dep of extraction.dependencies) {
    const taskId = idFor(dep.task);
    const depId = idFor(dep.depends_on);
    if (!taskId || !depId || taskId === depId) continue;
    await sb.from("tasks").update({ depends_on: [depId] }).eq("id", taskId);
  }

  for (const d of extraction.deadlines) {
    const due = d.due_at && !Number.isNaN(Date.parse(d.due_at))
      ? new Date(d.due_at).toISOString()
      : resolveDatePhrase(d.due_text || d.title, now);
    if (!due) continue;
    const { data: dupe } = await sb
      .from("deadlines")
      .select("id")
      .eq("title", d.title)
      .maybeSingle();
    if (dupe) continue;
    await sb.from("deadlines").insert({
      title: d.title,
      due_at: due,
      importance: Math.round(d.importance ?? 3),
      related_task_id: d.related_task_title ? idFor(d.related_task_title) : null,
    });
  }

  await recomputePriorities(sb, now);
  await recomputeGoalProgress(sb);

  return {
    goals: extraction.goals.length,
    tasks: insertedTaskIds.size,
    deadlines: extraction.deadlines.length,
  };
}

export async function recomputePriorities(sb: Sb, now = new Date()) {
  const tasks = await loadTasks(sb);
  const scorables = tasks.map(toScorable);
  for (const t of tasks) {
    const p = computePriority(toScorable(t), scorables, now);
    if (p.score !== t.priority_score || p.level !== t.priority) {
      await sb
        .from("tasks")
        .update({ priority_score: p.score, priority: p.level, reasoning: p.factors.join(" • ") })
        .eq("id", t.id);
    }
  }
}

export async function recomputeGoalProgress(sb: Sb) {
  const { data: goals } = await sb.from("goals").select("id,status");
  const tasks = await loadTasks(sb);
  for (const g of goals ?? []) {
    const related = tasks.filter((t) => t.goal_id === g.id && t.status !== "cancelled");
    if (related.length === 0) continue;
    const progress = Math.round(
      related.reduce((sum, t) => sum + (t.status === "completed" ? 100 : t.progress), 0) /
        related.length,
    );
    const status = progress >= 100 ? "completed" : g.status === "completed" ? "active" : g.status;
    await sb.from("goals").update({ progress, status }).eq("id", g.id);
  }
}

/* ------------------------------- Planning ------------------------------- */

export async function getAvailableMinutes(sb: Sb, fallback = 180): Promise<number> {
  const { data } = await sb
    .from("plans")
    .select("available_minutes")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.available_minutes ?? fallback;
}

export async function generatePlan(
  sb: Sb,
  opts: { availableMinutes: number; isReplan: boolean; reasoning?: string; now?: Date },
) {
  const now = opts.now ?? new Date();
  await recomputePriorities(sb, now);
  const tasks = await loadTasks(sb);
  const result = buildPlan(tasks.map(toScorable), opts.availableMinutes, now);

  const summaryParts = [result.summary];
  if (result.deferred.length) {
    summaryParts.push(
      `Deferred to your next session: ${result.deferred.map((d) => d.title).join(", ")}.`,
    );
  }

  const { data: plan, error } = await sb
    .from("plans")
    .insert({
      summary: summaryParts.join(" "),
      reasoning:
        opts.reasoning ??
        `Ranked every actionable task by deadline pressure, importance, progress and blocking impact, then filled your ${formatMinutes(opts.availableMinutes)} window.`,
      warnings: result.warnings,
      engine: "deterministic",
      is_replan: opts.isReplan,
      available_minutes: opts.availableMinutes,
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);

  if (result.items.length) {
    const { error: itemsError } = await sb.from("plan_items").insert(
      result.items.map((i) => ({
        plan_id: plan.id,
        task_id: i.task_id,
        kind: i.kind,
        title: i.title,
        start_at: i.start_at,
        end_at: i.end_at,
        estimated_minutes: i.estimated_minutes,
        priority: i.priority,
        reason: i.reason,
        position: i.position,
      })),
    );
    if (itemsError) throw new Error(itemsError.message);
  }

  await logEvent(sb, opts.isReplan ? "plan_replanned" : "plan_generated", {
    plan_id: plan.id,
    deferred: result.deferred.map((d) => d.title),
  });

  return { plan, deferred: result.deferred, warnings: result.warnings };
}

export async function currentPlan(sb: Sb) {
  const { data: plan } = await sb
    .from("plans")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!plan) return { plan: null, items: [] };
  const { data: items } = await sb
    .from("plan_items")
    .select("*")
    .eq("plan_id", plan.id)
    .order("position");
  return { plan, items: items ?? [] };
}

export async function nextActionFor(sb: Sb, now = new Date()) {
  const tasks = await loadTasks(sb);
  return selectNextAction(tasks.map(toScorable), now);
}
