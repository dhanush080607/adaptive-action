import { createServerFn } from "@tanstack/react-start";
import type { Database } from "@/integrations/supabase/types";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import {
  applyExtraction,
  currentPlan,
  evaluate,
  extractContext,
  generatePlan,
  getAvailableMinutes,
  loadTasks,
  logEvent,
  nextActionFor,
  recomputeGoalProgress,
  recomputePriorities,
  toScorable,
} from "./api.server";
import { computePriority } from "./priority";
import { contextExtractionSchema, FeedbackKinds, TaskStatuses } from "./types";
import { DEMO_INPUT } from "./demo";

type TaskUpdate = Database["public"]["Tables"]["tasks"]["Update"];

export const analyzeContext = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ raw_input: z.string().min(4).max(20000) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const now = new Date();
    const { extraction, engine, notice } = await extractContext(data.raw_input, now);
    const { data: row, error } = await context.supabase
      .from("contexts")
      .insert({
        raw_input: data.raw_input,
        summary: extraction.context_summary,
        extracted_goals: extraction.goals,
        extracted_tasks: extraction.tasks,
        extracted_deadlines: extraction.deadlines,
        constraints: extraction.constraints,
        available_time: extraction.available_time,
        dependencies: extraction.dependencies,
        progress: extraction.progress,
        engine,
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    await logEvent(context.supabase, "context_analyzed", { context_id: row.id, engine });
    return { context_id: row.id, extraction, engine, notice: notice ?? null };
  });

export const getLatestContext = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("contexts")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    return data ?? null;
  });

export const confirmContext = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        context_id: z.string().uuid(),
        extraction: contextExtractionSchema,
        available_minutes: z.number().min(15).max(960),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const now = new Date();
    const counts = await applyExtraction(context.supabase, data.extraction, now);
    await context.supabase
      .from("contexts")
      .update({
        applied: true,
        extracted_goals: data.extraction.goals,
        extracted_tasks: data.extraction.tasks,
        extracted_deadlines: data.extraction.deadlines,
        available_time: data.extraction.available_time,
        constraints: data.extraction.constraints,
      })
      .eq("id", data.context_id);
    const plan = await generatePlan(context.supabase, {
      availableMinutes: data.available_minutes,
      isReplan: false,
      now,
    });
    await logEvent(context.supabase, "context_applied", { ...counts });
    return { counts, plan_id: plan.plan.id };
  });

export const getDashboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = context.supabase;
    const now = new Date();
    const [tasks, { plan, items }, next] = await Promise.all([
      loadTasks(sb),
      currentPlan(sb),
      nextActionFor(sb, now),
    ]);
    const { data: goals } = await sb
      .from("goals")
      .select("*")
      .order("importance", { ascending: false });
    const { data: deadlines } = await sb
      .from("deadlines")
      .select("*")
      .gte("due_at", new Date(now.getTime() - 86400000).toISOString())
      .order("due_at")
      .limit(6);
    const { data: profile } = await sb.from("profiles").select("*").maybeSingle();

    const scorables = tasks.map(toScorable);
    const nextFactors = next
      ? computePriority(
          scorables.find((s) => s.id === next.task_id)!,
          scorables,
          now,
        ).factors
      : [];

    return {
      profile: profile ?? null,
      tasks,
      goals: goals ?? [],
      deadlines: deadlines ?? [],
      plan,
      plan_items: items,
      next_action: next ? { ...next, factors: nextFactors } : null,
      stats: {
        completed: tasks.filter((t) => t.status === "completed").length,
        delayed: tasks.filter((t) => t.status === "delayed").length,
        blocked: tasks.filter((t) => t.status === "blocked").length,
        open: tasks.filter((t) => ["pending", "in_progress", "delayed"].includes(t.status)).length,
      },
      server_now: now.toISOString(),
    };
  });

export const getTaskDetail = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    const tasks = await loadTasks(sb);
    const task = tasks.find((t) => t.id === data.id);
    if (!task) return null;
    const scorables = tasks.map(toScorable);
    const priority = computePriority(toScorable(task), scorables, new Date());
    const { data: goal } = task.goal_id
      ? await sb.from("goals").select("*").eq("id", task.goal_id).maybeSingle()
      : { data: null };
    const { data: feedback } = await sb
      .from("feedback")
      .select("*")
      .eq("task_id", task.id)
      .order("created_at", { ascending: false });
    return {
      task,
      goal: goal ?? null,
      priority,
      dependencies: tasks
        .filter((t) => (task.depends_on ?? []).includes(t.id))
        .map((t) => ({ id: t.id, title: t.title, status: t.status })),
      blocking: tasks
        .filter((t) => (t.depends_on ?? []).includes(task.id))
        .map((t) => ({ id: t.id, title: t.title, status: t.status })),
      feedback: feedback ?? [],
    };
  });

export const createTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        title: z.string().min(2).max(160),
        description: z.string().max(2000).optional(),
        estimated_minutes: z.number().min(5).max(600).default(45),
        importance: z.number().min(1).max(5).default(3),
        urgency: z.number().min(1).max(5).default(3),
        deadline: z.string().nullable().optional(),
        goal_id: z.string().uuid().nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("tasks")
      .insert({
        title: data.title,
        estimated_minutes: data.estimated_minutes,
        importance: data.importance,
        urgency: data.urgency,
        deadline: data.deadline ?? null,
        goal_id: data.goal_id ?? null,
        description: data.description ?? null,
        source: "manual",
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    await recomputePriorities(context.supabase);
    await logEvent(context.supabase, "task_created", { task_id: row.id });
    return row;
  });

export const updateTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        patch: z.object({
          title: z.string().min(2).max(160).optional(),
          description: z.string().max(2000).nullable().optional(),
          status: z.enum(TaskStatuses).optional(),
          progress: z.number().min(0).max(100).optional(),
          estimated_minutes: z.number().min(5).max(600).optional(),
          actual_minutes: z.number().min(0).max(1200).nullable().optional(),
          importance: z.number().min(1).max(5).optional(),
          urgency: z.number().min(1).max(5).optional(),
          deadline: z.string().nullable().optional(),
        }),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const patch: TaskUpdate = {};
    for (const [key, value] of Object.entries(data.patch)) {
      if (value !== undefined) (patch as Record<string, unknown>)[key] = value;
    }
    if (data.patch.status === "completed") {
      patch.completed_at = new Date().toISOString();
      patch.progress = 100;
    }
    const { data: row, error } = await context.supabase
      .from("tasks")
      .update(patch)
      .eq("id", data.id)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    await recomputePriorities(context.supabase);
    await recomputeGoalProgress(context.supabase);
    await logEvent(context.supabase, "task_updated", { task_id: data.id, patch: data.patch });
    return row;
  });

export const getCurrentPlan = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => currentPlan(context.supabase));

export const getNextAction = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => nextActionFor(context.supabase));

export const replan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ available_minutes: z.number().min(15).max(960).optional() }).parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    const minutes = data.available_minutes ?? (await getAvailableMinutes(context.supabase));
    const result = await generatePlan(context.supabase, {
      availableMinutes: minutes,
      isReplan: true,
    });
    return { plan: result.plan, warnings: result.warnings, next_action: await nextActionFor(context.supabase) };
  });

export const submitFeedback = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        task_id: z.string().uuid(),
        kind: z.enum(FeedbackKinds),
        note: z.string().max(1000).optional(),
        actual_minutes: z.number().min(0).max(1200).optional(),
        progress: z.number().min(0).max(100).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    const now = new Date();
    const tasks = await loadTasks(sb);
    const task = tasks.find((t) => t.id === data.task_id);
    if (!task) throw new Error("Task not found");

    const previous = await currentPlan(sb);

    const patch: TaskUpdate = {};
    switch (data.kind) {
      case "completed":
        patch.status = "completed";
        patch.progress = 100;
        patch.completed_at = now.toISOString();
        break;
      case "partial":
        patch.status = "in_progress";
        patch.progress = Math.max(task.progress, data.progress ?? Math.min(task.progress + 40, 90));
        break;
      case "delayed":
      case "skipped":
        patch.status = "delayed";
        patch.urgency = Math.min(5, task.urgency + 1);
        break;
      case "blocked":
        patch.status = "blocked";
        break;
      case "not_relevant":
        patch.status = "cancelled";
        break;
      case "took_longer":
        patch.status = "completed";
        patch.progress = 100;
        patch.completed_at = now.toISOString();
        break;
    }
    if (data.actual_minutes != null) patch.actual_minutes = data.actual_minutes;

    const { error: upErr } = await sb.from("tasks").update(patch).eq("id", data.task_id);
    if (upErr) throw new Error(upErr.message);

    await sb.from("feedback").insert({
      task_id: data.task_id,
      kind: data.kind,
      note: data.note ?? null,
      actual_minutes: data.actual_minutes ?? null,
    });

    const availableMinutes = await getAvailableMinutes(sb);
    const spent = data.actual_minutes ?? task.estimated_minutes;
    const remainingWindow = Math.max(30, availableMinutes - Math.max(0, spent));

    const openTitles = tasks
      .filter((t) => t.id !== task.id && ["pending", "in_progress", "delayed"].includes(t.status))
      .map((t) => t.title);

    const { evaluation, engine } = await evaluate({
      kind: data.kind,
      taskTitle: task.title,
      estimatedMinutes: task.estimated_minutes,
      actualMinutes: data.actual_minutes ?? null,
      note: data.note ?? null,
      openTasks: openTitles,
      availableMinutes: remainingWindow,
    });

    await recomputeGoalProgress(sb);
    await logEvent(sb, "feedback_received", {
      task_id: data.task_id,
      kind: data.kind,
      should_replan: evaluation.should_replan,
    });

    let planResult = null;
    if (evaluation.should_replan) {
      planResult = await generatePlan(sb, {
        availableMinutes: remainingWindow,
        isReplan: true,
        reasoning: evaluation.reason,
        now,
      });
    }

    const after = await currentPlan(sb);
    return {
      evaluation,
      engine,
      replanned: Boolean(planResult),
      previous_plan_items: previous.items,
      plan: after.plan,
      plan_items: after.items,
      next_action: await nextActionFor(sb, now),
      remaining_minutes: remainingWindow,
    };
  });

export const getInsights = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = context.supabase;
    const tasks = await loadTasks(sb);
    const { data: goals } = await sb.from("goals").select("*");
    const { data: events } = await sb
      .from("activity_events")
      .select("event_type,created_at")
      .order("created_at", { ascending: false })
      .limit(500);
    const { data: feedback } = await sb.from("feedback").select("*");
    const { data: deadlines } = await sb
      .from("deadlines")
      .select("*")
      .gte("due_at", new Date().toISOString())
      .order("due_at")
      .limit(8);

    const completed = tasks.filter((t) => t.status === "completed");
    const withBoth = tasks.filter((t) => t.actual_minutes != null && t.estimated_minutes > 0);
    const estimateAccuracy = withBoth.length
      ? Math.round(
          (withBoth.reduce((s, t) => s + t.estimated_minutes / (t.actual_minutes || 1), 0) /
            withBoth.length) *
            100,
        )
      : null;

    return {
      total_tasks: tasks.length,
      completed: completed.length,
      delayed: tasks.filter((t) => t.status === "delayed").length,
      blocked: tasks.filter((t) => t.status === "blocked").length,
      completion_rate: tasks.length ? Math.round((completed.length / tasks.length) * 100) : 0,
      estimate_accuracy: estimateAccuracy,
      replans: (events ?? []).filter((e) => e.event_type === "plan_replanned").length,
      feedback_count: (feedback ?? []).length,
      goals: (goals ?? []).map((g) => ({ id: g.id, title: g.title, progress: g.progress })),
      upcoming: deadlines ?? [],
      estimated_vs_actual: withBoth.map((t) => ({
        title: t.title,
        estimated: t.estimated_minutes,
        actual: t.actual_minutes ?? 0,
      })),
      activity: (events ?? []).slice(0, 12),
    };
  });

export const loadDemoScenario = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await logEvent(context.supabase, "demo_loaded", {});
    return { raw_input: DEMO_INPUT };
  });

export const resetWorkspace = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = context.supabase;
    const uid = context.userId;
    for (const table of ["plan_items", "plans", "feedback", "deadlines", "tasks", "goals", "contexts"] as const) {
      await sb.from(table).delete().eq("user_id", uid);
    }
    await logEvent(sb, "workspace_reset", {});
    return { ok: true };
  });
