import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/integrations/supabase/types";
import { AiUnavailableError, generateStructured } from "./ai.server";
import { localExtractContext, resolveDatePhrase } from "./fallback";
import {
  buildPlan,
  evaluateFeedback,
  formatMinutes,
  selectNextAction,
} from "./planner";
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

/* -------------------------------------------------------------------------- */
/*                                Task Helpers                                */
/* -------------------------------------------------------------------------- */

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
  const { data, error } = await sb
    .from("tasks")
    .select("*")
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return data ?? [];
}

export async function logEvent(
  sb: Sb,
  event_type: string,
  details: Record<string, unknown> = {},
) {
  const { error } = await sb.from("activity_events").insert({
    event_type,
    details: details as Json,
  });

  if (error) {
    console.error("[lifeos] activity log failed:", error.message);
  }
}

/* -------------------------------------------------------------------------- */
/*                              Context Extraction                            */
/* -------------------------------------------------------------------------- */

const CONTEXT_JSON_SCHEMA = {
  type: "object",
  properties: {
    context_summary: {
      type: "string",
    },

    goals: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: {
            type: "string",
          },
          description: {
            type: "string",
          },
          importance: {
            type: "number",
          },
          deadline_text: {
            type: "string",
          },
          certainty: {
            type: "string",
            enum: ["explicit", "inferred", "uncertain"],
          },
        },
        required: ["title"],
      },
    },

    tasks: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: {
            type: "string",
          },
          description: {
            type: "string",
          },
          goal_title: {
            type: "string",
          },
          importance: {
            type: "number",
          },
          urgency: {
            type: "number",
          },
          estimated_minutes: {
            type: "number",
          },
          progress: {
            type: "number",
          },
          status: {
            type: "string",
            enum: [
              "pending",
              "in_progress",
              "completed",
              "blocked",
            ],
          },
          deadline_text: {
            type: "string",
          },
          depends_on_titles: {
            type: "array",
            items: {
              type: "string",
            },
          },
          certainty: {
            type: "string",
            enum: ["explicit", "inferred", "uncertain"],
          },
        },
        required: ["title"],
      },
    },

    deadlines: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: {
            type: "string",
          },
          due_at: {
            type: "string",
          },
          due_text: {
            type: "string",
          },
          importance: {
            type: "number",
          },
          related_task_title: {
            type: "string",
          },
        },
        required: ["title"],
      },
    },

    constraints: {
      type: "array",
      items: {
        type: "string",
      },
    },

    available_time: {
      type: "array",
      items: {
        type: "object",
        properties: {
          label: {
            type: "string",
          },
          minutes: {
            type: "number",
          },
        },
        required: ["label", "minutes"],
      },
    },

    dependencies: {
      type: "array",
      items: {
        type: "object",
        properties: {
          task: {
            type: "string",
          },
          depends_on: {
            type: "string",
          },
        },
        required: ["task", "depends_on"],
      },
    },

    progress: {
      type: "array",
      items: {
        type: "object",
        properties: {
          task: {
            type: "string",
          },
          percent: {
            type: "number",
          },
        },
        required: ["task", "percent"],
      },
    },

    open_questions: {
      type: "array",
      items: {
        type: "string",
      },
    },
  },

  required: [
    "context_summary",
    "goals",
    "tasks",
    "deadlines",
  ],
};

export async function extractContext(
  raw: string,
  now: Date,
): Promise<{
  extraction: ContextExtraction;
  engine: "ai" | "fallback";
  notice?: string;
}> {
  const system = `
You are the Context Engine of LifeOS, an AI action system for students.

Convert messy natural language into structured context.

Rules:
- Only extract information that is present or reasonably implied.
- NEVER invent facts.
- Mark unclear information as "inferred" or "uncertain".
- Break study material lists into one task per topic.
- estimated_minutes must be a realistic effort estimate for a student.
- importance and urgency must be integers from 1 to 5.
- progress must be between 0 and 100.
- If the user says something is completed, set status to "completed" and progress to 100.
- deadline_text should preserve the user's wording where possible.
- Resolve due dates when possible.
- available_time should capture how much time the user has.
- Put ambiguous information into open_questions.

Current time:
${now.toISOString()}
`;

  try {
    const extraction = await generateStructured({
      schema: contextExtractionSchema,
      jsonSchema: CONTEXT_JSON_SCHEMA,
      schemaName: "life_context",
      system,
      user: raw,
    });

    return {
      extraction: contextExtractionSchema.parse(extraction),
      engine: "ai",
    };
  } catch (err) {
    const error = err as AiUnavailableError;

    console.error(
      "[lifeos] context AI failed, using local fallback:",
      error.code ?? error.message,
    );

    return {
      extraction: localExtractContext(raw, now),
      engine: "fallback",
      notice: "AI unavailable — used the local planning fallback.",
    };
  }
}

/* -------------------------------------------------------------------------- */
/*                             Feedback Evaluation                            */
/* -------------------------------------------------------------------------- */

const EVAL_JSON_SCHEMA = {
  type: "object",
  properties: {
    outcome: {
      type: "string",
    },
    changes: {
      type: "array",
      items: {
        type: "string",
      },
    },
    affected_tasks: {
      type: "array",
      items: {
        type: "string",
      },
    },
    should_replan: {
      type: "boolean",
    },
    reason: {
      type: "string",
    },
  },

  required: [
    "outcome",
    "changes",
    "should_replan",
    "reason",
  ],
};

export async function evaluate(args: {
  kind: FeedbackKind;
  taskTitle: string;
  estimatedMinutes: number;
  actualMinutes?: number | null;
  note?: string | null;
  openTasks: string[];
  availableMinutes: number;
}): Promise<{
  evaluation: Evaluation;
  engine: "ai" | "fallback";
}> {
  const local = evaluateFeedback(args);

  const system = `
You are the Evaluation Engine of LifeOS.

Given feedback on a task:
- Explain what happened.
- Identify what changed.
- Identify affected tasks.
- Decide whether the current plan should be rebuilt.
- Keep the response concise.
- Never invent tasks.
- Never expose hidden reasoning or chain-of-thought.
`;

  const user = `
Task: ${args.taskTitle}

Feedback: ${args.kind}

Estimated minutes: ${args.estimatedMinutes}

Actual minutes: ${args.actualMinutes ?? "unknown"}

User note: ${args.note ?? "none"}

Remaining open tasks:
${args.openTasks.join(", ") || "none"}

Time available:
${args.availableMinutes} minutes
`;

  try {
    const evaluation = await generateStructured({
      schema: evaluationSchema,
      jsonSchema: EVAL_JSON_SCHEMA,
      schemaName: "evaluation",
      system,
      user,
    });

    return {
      evaluation: evaluationSchema.parse(evaluation),
      engine: "ai",
    };
  } catch (error) {
    console.error(
      "[lifeos] evaluation AI failed, using deterministic evaluation:",
      error,
    );

    return {
      evaluation: local,
      engine: "fallback",
    };
  }
}

/* -------------------------------------------------------------------------- */
/*                         Context -> Database Records                        */
/* -------------------------------------------------------------------------- */

export async function applyExtraction(
  sb: Sb,
  extraction: ContextExtraction,
  now: Date,
): Promise<{
  goals: number;
  tasks: number;
  deadlines: number;
}> {
  const goalIdByTitle = new Map<string, string>();

  /* ------------------------------- Goals -------------------------------- */

  const { data: existingGoals, error: goalsError } = await sb
    .from("goals")
    .select("id,title");

  if (goalsError) {
    throw new Error(goalsError.message);
  }

  for (const goal of existingGoals ?? []) {
    goalIdByTitle.set(
      goal.title.toLowerCase().trim(),
      goal.id,
    );
  }

  let createdGoals = 0;

  for (const goal of extraction.goals) {
    const normalizedTitle = goal.title.toLowerCase().trim();

    if (goalIdByTitle.has(normalizedTitle)) {
      continue;
    }

    const { data, error } = await sb
      .from("goals")
      .insert({
        title: goal.title,
        description: goal.description || null,
        importance: Math.round(goal.importance ?? 3),
        deadline: resolveDatePhrase(
          goal.deadline_text ?? "",
          now,
        ),
      })
      .select("id")
      .single();

    if (error) {
      throw new Error(error.message);
    }

    goalIdByTitle.set(normalizedTitle, data.id);
    createdGoals++;
  }

  /* ------------------------------- Tasks -------------------------------- */

  const { data: existingTasks, error: existingTasksError } =
    await sb.from("tasks").select("id,title");

  if (existingTasksError) {
    throw new Error(existingTasksError.message);
  }

  const existingTitles = new Set(
    (existingTasks ?? []).map((task) =>
      task.title.toLowerCase().trim(),
    ),
  );

  const insertedTaskIds = new Map<string, string>();

  for (const task of extraction.tasks) {
    const normalizedTitle = task.title.toLowerCase().trim();

    if (existingTitles.has(normalizedTitle)) {
      continue;
    }

    const goalId = task.goal_title
      ? goalIdByTitle.get(
          task.goal_title.toLowerCase().trim(),
        ) ?? null
      : null;

    const deadline = resolveDatePhrase(
      task.deadline_text ?? "",
      now,
    );

    const completed = task.status === "completed";

    const estimatedMinutes = Math.max(
      5,
      Math.min(
        600,
        Math.round(task.estimated_minutes ?? 45),
      ),
    );

    const importance = Math.max(
      1,
      Math.min(5, Math.round(task.importance ?? 3)),
    );

    const urgency = Math.max(
      1,
      Math.min(5, Math.round(task.urgency ?? 3)),
    );

    const progress = completed
      ? 100
      : Math.max(
          0,
          Math.min(100, Math.round(task.progress ?? 0)),
        );

    const { data, error } = await sb
      .from("tasks")
      .insert({
        goal_id: goalId,
        title: task.title,
        description: task.description || null,
        status: completed
          ? "completed"
          : (task.status ?? "pending"),
        progress,
        importance,
        urgency,
        estimated_minutes: estimatedMinutes,
        deadline,
        source: "context",
        reasoning:
          task.certainty === "explicit"
            ? "Stated directly in your input"
            : "Inferred from your input",
        completed_at: completed
          ? now.toISOString()
          : null,
      })
      .select("id")
      .single();

    if (error) {
      throw new Error(error.message);
    }

    existingTitles.add(normalizedTitle);

    insertedTaskIds.set(
      normalizedTitle,
      data.id,
    );
  }

  /* ---------------------------- Dependencies ---------------------------- */

  const { data: allTasks, error: allTasksError } =
    await sb.from("tasks").select("id,title");

  if (allTasksError) {
    throw new Error(allTasksError.message);
  }

  const idFor = (title: string) =>
    (allTasks ?? []).find(
      (task) =>
        task.title.toLowerCase().trim() ===
        title.toLowerCase().trim(),
    )?.id ?? null;

  for (const dependency of extraction.dependencies) {
    const taskId = idFor(dependency.task);
    const dependencyId = idFor(
      dependency.depends_on,
    );

    if (
      !taskId ||
      !dependencyId ||
      taskId === dependencyId
    ) {
      continue;
    }

    await sb
      .from("tasks")
      .update({
        depends_on: [dependencyId],
      })
      .eq("id", taskId);
  }

  /* ------------------------------ Deadlines ------------------------------ */

  let createdDeadlines = 0;

  for (const deadline of extraction.deadlines) {
    const due =
      deadline.due_at &&
      !Number.isNaN(
        Date.parse(deadline.due_at),
      )
        ? new Date(deadline.due_at).toISOString()
        : resolveDatePhrase(
            deadline.due_text ||
              deadline.title,
            now,
          );

    if (!due) {
      continue;
    }

    const { data: duplicates } = await sb
      .from("deadlines")
      .select("id")
      .eq("title", deadline.title)
      .limit(1);

    if (
      duplicates &&
      duplicates.length > 0
    ) {
      continue;
    }

    await sb.from("deadlines").insert({
      title: deadline.title,
      due_at: due,
      importance: Math.max(
        1,
        Math.min(
          5,
          Math.round(
            deadline.importance ?? 3,
          ),
        ),
      ),
      related_task_id:
        deadline.related_task_title
          ? idFor(
              deadline.related_task_title,
            )
          : null,
    });

    createdDeadlines++;
  }

  /* ------------------------- Recompute derived data --------------------- */

  await recomputePriorities(sb, now);
  await recomputeGoalProgress(sb);

  return {
    goals: createdGoals,
    tasks: insertedTaskIds.size,
    deadlines: createdDeadlines,
  };
}

/* -------------------------------------------------------------------------- */
/*                            Priority Recalculation                          */
/* -------------------------------------------------------------------------- */

export async function recomputePriorities(
  sb: Sb,
  now = new Date(),
) {
  const tasks = await loadTasks(sb);
  const scorables = tasks.map(toScorable);

  for (const task of tasks) {
    const priority = computePriority(
      toScorable(task),
      scorables,
      now,
    );

    if (
      priority.score !== task.priority_score ||
      priority.level !== task.priority
    ) {
      const { error } = await sb
        .from("tasks")
        .update({
          priority_score: priority.score,
          priority: priority.level,
          reasoning: priority.factors.join(" • "),
        })
        .eq("id", task.id);

      if (error) {
        console.error(
          "[lifeos] priority update failed:",
          error.message,
        );
      }
    }
  }
}

/* -------------------------------------------------------------------------- */
/*                            Goal Progress                                   */
/* -------------------------------------------------------------------------- */

export async function recomputeGoalProgress(
  sb: Sb,
) {
  const { data: goals, error: goalsError } =
    await sb
      .from("goals")
      .select("id,status");

  if (goalsError) {
    throw new Error(goalsError.message);
  }

  const tasks = await loadTasks(sb);

  for (const goal of goals ?? []) {
    const relatedTasks = tasks.filter(
      (task) =>
        task.goal_id === goal.id &&
        task.status !== "cancelled",
    );

    if (relatedTasks.length === 0) {
      continue;
    }

    const progress = Math.round(
      relatedTasks.reduce(
        (sum, task) =>
          sum +
          (task.status === "completed"
            ? 100
            : task.progress),
        0,
      ) / relatedTasks.length,
    );

    const status =
      progress >= 100
        ? "completed"
        : goal.status === "completed"
          ? "active"
          : goal.status;

    await sb
      .from("goals")
      .update({
        progress,
        status,
      })
      .eq("id", goal.id);
  }
}

/* -------------------------------------------------------------------------- */
/*                         Available Planning Time                            */
/* -------------------------------------------------------------------------- */

export async function getAvailableMinutes(
  sb: Sb,
  fallback = 180,
): Promise<number> {
  const { data } = await sb
    .from("plans")
    .select("available_minutes")
    .order("created_at", {
      ascending: false,
    })
    .limit(1)
    .maybeSingle();

  const minutes =
    data?.available_minutes ?? fallback;

  return Math.max(
    0,
    Math.min(960, minutes),
  );
}

/* -------------------------------------------------------------------------- */
/*                              Plan Generation                               */
/* -------------------------------------------------------------------------- */

export async function generatePlan(
  sb: Sb,
  opts: {
    availableMinutes: number;
    isReplan: boolean;
    reasoning?: string;
    now?: Date;
  },
) {
  const now = opts.now ?? new Date();

  const availableMinutes = Math.max(
    0,
    Math.min(960, opts.availableMinutes),
  );

  await recomputePriorities(
    sb,
    now,
  );

  const tasks = await loadTasks(sb);

  const result = buildPlan(
    tasks.map(toScorable),
    availableMinutes,
    now,
  );

  const summaryParts = [
    result.summary,
  ];

  if (result.deferred.length > 0) {
    summaryParts.push(
      `Deferred to your next session: ${result.deferred
        .map((task) => task.title)
        .join(", ")}.`,
    );
  }

  const { data: plan, error } =
    await sb
      .from("plans")
      .insert({
        summary:
          summaryParts.join(" "),

        reasoning:
          opts.reasoning ??
          `Ranked actionable tasks by deadline pressure, importance, progress, dependencies and blocking impact, then filled the available ${formatMinutes(
            availableMinutes,
          )} window.`,

        warnings: result.warnings,

        engine: "deterministic",

        is_replan: opts.isReplan,

        available_minutes:
          availableMinutes,
      })
      .select("*")
      .single();

  if (error) {
    throw new Error(error.message);
  }

  /* ----------------------------- Plan Items ----------------------------- */

  if (result.items.length > 0) {
    const { error: itemsError } =
      await sb.from("plan_items").insert(
        result.items.map((item) => ({
          plan_id: plan.id,
          task_id: item.task_id,
          kind: item.kind,
          title: item.title,
          start_at: item.start_at,
          end_at: item.end_at,
          estimated_minutes:
            item.estimated_minutes,
          priority: item.priority,
          reason: item.reason,
          position: item.position,
        })),
      );

    if (itemsError) {
      throw new Error(
        itemsError.message,
      );
    }
  }

  await logEvent(
    sb,
    opts.isReplan
      ? "plan_replanned"
      : "plan_generated",
    {
      plan_id: plan.id,
      deferred:
        result.deferred.map(
          (task) => task.title,
        ),
    },
  );

  return {
    plan,
    deferred: result.deferred,
    warnings: result.warnings,
  };
}

/* -------------------------------------------------------------------------- */
/*                              Current Plan                                  */
/* -------------------------------------------------------------------------- */

export async function currentPlan(
  sb: Sb,
) {
  const { data: plan, error } =
    await sb
      .from("plans")
      .select("*")
      .order("created_at", {
        ascending: false,
      })
      .limit(1)
      .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!plan) {
    return {
      plan: null,
      items: [],
    };
  }

  const { data: items, error: itemsError } =
    await sb
      .from("plan_items")
      .select("*")
      .eq("plan_id", plan.id)
      .order("position", {
        ascending: true,
      });

  if (itemsError) {
    throw new Error(
      itemsError.message,
    );
  }

  return {
    plan,
    items: items ?? [],
  };
}

/* -------------------------------------------------------------------------- */
/*                              Next Action                                   */
/* -------------------------------------------------------------------------- */

export async function nextActionFor(
  sb: Sb,
  now = new Date(),
) {
  const tasks = await loadTasks(sb);

  return selectNextAction(
    tasks.map(toScorable),
    now,
  );
}