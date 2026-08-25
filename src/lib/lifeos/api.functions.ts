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
import {
  contextExtractionSchema,
  FeedbackKinds,
  TaskStatuses,
} from "./types";

import { DEMO_INPUT } from "./demo";

type TaskUpdate =
  Database["public"]["Tables"]["tasks"]["Update"];

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function isOpenTask(status: string) {
  return [
    "pending",
    "in_progress",
    "delayed",
  ].includes(status);
}

function isTerminalTask(status: string) {
  return [
    "completed",
    "cancelled",
  ].includes(status);
}

function clamp(
  value: number,
  min: number,
  max: number,
) {
  return Math.min(
    max,
    Math.max(min, value),
  );
}

/* -------------------------------------------------------------------------- */
/* Analyze Context                                                            */
/* -------------------------------------------------------------------------- */

export const analyzeContext = createServerFn({
  method: "POST",
})
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) =>
    z
      .object({
        raw_input: z
          .string()
          .trim()
          .min(4)
          .max(20000),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const now = new Date();

    const result = await extractContext(
      data.raw_input,
      now,
    );

    const {
      extraction,
      engine,
      notice,
    } = result;

    const { data: row, error } =
      await context.supabase
        .from("contexts")
        .insert({
          raw_input: data.raw_input,

          summary:
            extraction.context_summary,

          extracted_goals:
            extraction.goals,

          extracted_tasks:
            extraction.tasks,

          extracted_deadlines:
            extraction.deadlines,

          constraints:
            extraction.constraints,

          available_time:
            extraction.available_time,

          dependencies:
            extraction.dependencies,

          progress:
            extraction.progress,

          engine,
        })
        .select("*")
        .single();

    if (error || !row) {
      console.error(
        "[lifeos.api] failed to save context",
        error,
      );

      throw new Error(
        error?.message ??
          "Failed to save analyzed context.",
      );
    }

    await logEvent(
      context.supabase,
      "context_analyzed",
      {
        context_id: row.id,
        engine,
      },
    );

    return {
      context_id: row.id,
      extraction,
      engine,
      notice: notice ?? null,
    };
  });

/* -------------------------------------------------------------------------- */
/* Get Latest Context                                                         */
/* -------------------------------------------------------------------------- */

export const getLatestContext = createServerFn({
  method: "GET",
})
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const {
      data,
      error,
    } = await context.supabase
      .from("contexts")
      .select("*")
      .order("created_at", {
        ascending: false,
      })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error(
        "[lifeos.api] latest context error",
        error,
      );

      throw new Error(
        error.message,
      );
    }

    return data ?? null;
  });

/* -------------------------------------------------------------------------- */
/* Confirm Context                                                            */
/* -------------------------------------------------------------------------- */

export const confirmContext = createServerFn({
  method: "POST",
})
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) =>
    z
      .object({
        context_id: z.string().uuid(),

        extraction:
          contextExtractionSchema,

        available_minutes: z
          .number()
          .min(15)
          .max(960),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    const now = new Date();

    /*
     * First verify that the context actually exists.
     * This prevents applying an unknown context.
     */
    const {
      data: existingContext,
      error: contextLookupError,
    } = await sb
      .from("contexts")
      .select("id")
      .eq("id", data.context_id)
      .maybeSingle();

    if (contextLookupError) {
      throw new Error(
        contextLookupError.message,
      );
    }

    if (!existingContext) {
      throw new Error(
        "Context not found.",
      );
    }

    const counts =
      await applyExtraction(
        sb,
        data.extraction,
        now,
      );

    const {
      error: updateError,
    } = await sb
      .from("contexts")
      .update({
        applied: true,

        extracted_goals:
          data.extraction.goals,

        extracted_tasks:
          data.extraction.tasks,

        extracted_deadlines:
          data.extraction.deadlines,

        available_time:
          data.extraction.available_time,

        constraints:
          data.extraction.constraints,

        dependencies:
          data.extraction.dependencies,

        progress:
          data.extraction.progress,
      })
      .eq(
        "id",
        data.context_id,
      );

    if (updateError) {
      throw new Error(
        updateError.message,
      );
    }

    const plan =
      await generatePlan(sb, {
        availableMinutes:
          data.available_minutes,

        isReplan: false,

        now,
      });

    await logEvent(
      sb,
      "context_applied",
      {
        context_id:
          data.context_id,

        ...counts,
      },
    );

    return {
      counts,

      plan_id:
        plan.plan.id,

      warnings:
        plan.warnings ?? [],
    };
  });

/* -------------------------------------------------------------------------- */
/* Dashboard                                                                  */
/* -------------------------------------------------------------------------- */

export const getDashboard = createServerFn({
  method: "GET",
})
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = context.supabase;
    const now = new Date();

    const [
      tasks,
      currentPlanResult,
      next,
    ] = await Promise.all([
      loadTasks(sb),
      currentPlan(sb),
      nextActionFor(
        sb,
        now,
      ),
    ]);

    const {
      plan,
      items,
    } = currentPlanResult;

    const {
      data: goals,
      error: goalsError,
    } = await sb
      .from("goals")
      .select("*")
      .order(
        "importance",
        {
          ascending: false,
        },
      );

    if (goalsError) {
      throw new Error(
        goalsError.message,
      );
    }

    const {
      data: deadlines,
      error: deadlinesError,
    } = await sb
      .from("deadlines")
      .select("*")
      .gte(
        "due_at",
        new Date(
          now.getTime() -
            86400000,
        ).toISOString(),
      )
      .order("due_at")
      .limit(6);

    if (deadlinesError) {
      throw new Error(
        deadlinesError.message,
      );
    }

    const {
      data: profile,
      error: profileError,
    } = await sb
      .from("profiles")
      .select("*")
      .maybeSingle();

    if (profileError) {
      throw new Error(
        profileError.message,
      );
    }

    const scorables =
      tasks.map(toScorable);

    let nextWithFactors = null;

    if (next) {
      const nextScorable =
        scorables.find(
          (s) =>
            s.id ===
            next.task_id,
        );

      /*
       * Do not use `!` here.
       *
       * The old code could crash if the task was deleted
       * between calculating nextAction and calculating
       * priority.
       */
      if (nextScorable) {
        nextWithFactors = {
          ...next,
          factors:
            computePriority(
              nextScorable,
              scorables,
              now,
            ).factors,
        };
      } else {
        nextWithFactors = {
          ...next,
          factors: [],
        };
      }
    }

    const completed =
      tasks.filter(
        (task) =>
          task.status ===
          "completed",
      ).length;

    const delayed =
      tasks.filter(
        (task) =>
          task.status ===
          "delayed",
      ).length;

    const blocked =
      tasks.filter(
        (task) =>
          task.status ===
          "blocked",
      ).length;

    const open =
      tasks.filter(
        (task) =>
          isOpenTask(
            task.status,
          ),
      ).length;

    return {
      profile:
        profile ?? null,

      tasks,

      goals:
        goals ?? [],

      deadlines:
        deadlines ?? [],

      plan,

      plan_items:
        items,

      next_action:
        nextWithFactors,

      stats: {
        completed,

        delayed,

        blocked,

        open,

        total:
          tasks.length,

        completion_rate:
          tasks.length
            ? Math.round(
                (completed /
                  tasks.length) *
                  100,
              )
            : 0,
      },

      server_now:
        now.toISOString(),
    };
  });

/* -------------------------------------------------------------------------- */
/* Task Detail                                                                */
/* -------------------------------------------------------------------------- */

export const getTaskDetail = createServerFn({
  method: "GET",
})
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) =>
    z
      .object({
        id: z.string().uuid(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const sb = context.supabase;

    const tasks =
      await loadTasks(sb);

    const task =
      tasks.find(
        (t) =>
          t.id === data.id,
      );

    if (!task) {
      return null;
    }

    const scorables =
      tasks.map(toScorable);

    const priority =
      computePriority(
        toScorable(task),
        scorables,
        new Date(),
      );

    let goal = null;

    if (task.goal_id) {
      const {
        data: goalData,
        error,
      } = await sb
        .from("goals")
        .select("*")
        .eq(
          "id",
          task.goal_id,
        )
        .maybeSingle();

      if (error) {
        throw new Error(
          error.message,
        );
      }

      goal = goalData;
    }

    const {
      data: feedback,
      error: feedbackError,
    } = await sb
      .from("feedback")
      .select("*")
      .eq(
        "task_id",
        task.id,
      )
      .order(
        "created_at",
        {
          ascending: false,
        },
      );

    if (feedbackError) {
      throw new Error(
        feedbackError.message,
      );
    }

    return {
      task,

      goal,

      priority,

      dependencies:
        tasks
          .filter(
            (t) =>
              (
                task.depends_on ??
                []
              ).includes(t.id),
          )
          .map((t) => ({
            id: t.id,
            title: t.title,
            status: t.status,
          })),

      blocking:
        tasks
          .filter(
            (t) =>
              (
                t.depends_on ??
                []
              ).includes(
                task.id,
              ),
          )
          .map((t) => ({
            id: t.id,
            title: t.title,
            status: t.status,
          })),

      feedback:
        feedback ?? [],
    };
  });

/* -------------------------------------------------------------------------- */
/* Create Task                                                                */
/* -------------------------------------------------------------------------- */

export const createTask = createServerFn({
  method: "POST",
})
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) =>
    z
      .object({
        title: z
          .string()
          .trim()
          .min(2)
          .max(160),

        description:
          z
            .string()
            .max(2000)
            .nullable()
            .optional(),

        estimated_minutes:
          z
            .number()
            .min(5)
            .max(600)
            .default(45),

        importance:
          z
            .number()
            .min(1)
            .max(5)
            .default(3),

        urgency:
          z
            .number()
            .min(1)
            .max(5)
            .default(3),

        deadline:
          z
            .string()
            .nullable()
            .optional(),

        goal_id:
          z
            .string()
            .uuid()
            .nullable()
            .optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const sb = context.supabase;

    /*
     * If a goal is supplied, verify it exists.
     */
    if (data.goal_id) {
      const {
        data: goal,
        error,
      } = await sb
        .from("goals")
        .select("id")
        .eq(
          "id",
          data.goal_id,
        )
        .maybeSingle();

      if (error) {
        throw new Error(
          error.message,
        );
      }

      if (!goal) {
        throw new Error(
          "Selected goal was not found.",
        );
      }
    }

    const {
      data: row,
      error,
    } = await sb
      .from("tasks")
      .insert({
        title: data.title,

        estimated_minutes:
          data.estimated_minutes,

        importance:
          data.importance,

        urgency:
          data.urgency,

        deadline:
          data.deadline ??
          null,

        goal_id:
          data.goal_id ??
          null,

        description:
          data.description ??
          null,

        source: "manual",
      })
      .select("*")
      .single();

    if (error || !row) {
      throw new Error(
        error?.message ??
          "Failed to create task.",
      );
    }

    await recomputePriorities(
      sb,
    );

    await recomputeGoalProgress(
      sb,
    );

    await logEvent(
      sb,
      "task_created",
      {
        task_id: row.id,
      },
    );

    return row;
  });

/* -------------------------------------------------------------------------- */
/* Update Task                                                                */
/* -------------------------------------------------------------------------- */

export const updateTask = createServerFn({
  method: "POST",
})
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) =>
    z
      .object({
        id: z.string().uuid(),

        patch: z.object({
          title: z
            .string()
            .trim()
            .min(2)
            .max(160)
            .optional(),

          description:
            z
              .string()
              .max(2000)
              .nullable()
              .optional(),

          status:
            z.enum(
              TaskStatuses,
            ).optional(),

          progress:
            z
              .number()
              .min(0)
              .max(100)
              .optional(),

          estimated_minutes:
            z
              .number()
              .min(5)
              .max(600)
              .optional(),

          actual_minutes:
            z
              .number()
              .min(0)
              .max(1200)
              .nullable()
              .optional(),

          importance:
            z
              .number()
              .min(1)
              .max(5)
              .optional(),

          urgency:
            z
              .number()
              .min(1)
              .max(5)
              .optional(),

          deadline:
            z
              .string()
              .nullable()
              .optional(),
        }),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const sb = context.supabase;

    /*
     * Verify task exists before updating.
     */
    const {
      data: existingTask,
      error: lookupError,
    } = await sb
      .from("tasks")
      .select("id,status,progress")
      .eq(
        "id",
        data.id,
      )
      .maybeSingle();

    if (lookupError) {
      throw new Error(
        lookupError.message,
      );
    }

    if (!existingTask) {
      throw new Error(
        "Task not found.",
      );
    }

    const patch: TaskUpdate = {};

    for (
      const [key, value]
      of Object.entries(
        data.patch,
      )
    ) {
      if (
        value !==
        undefined
      ) {
        (
          patch as Record<
            string,
            unknown
          >
        )[key] = value;
      }
    }

    if (
      data.patch.status ===
      "completed"
    ) {
      patch.completed_at =
        new Date().toISOString();

      patch.progress = 100;
    }

    /*
     * If progress reaches 100, automatically
     * mark the task completed.
     */
    if (
      data.patch.progress ===
        100 &&
      data.patch.status !==
        "cancelled"
    ) {
      patch.status =
        "completed";

      patch.completed_at =
        new Date().toISOString();
    }

    /*
     * If task moves away from completed,
     * clear completion timestamp.
     */
    if (
      data.patch.status &&
      data.patch.status !==
        "completed"
    ) {
      patch.completed_at =
        null;
    }

    const {
      data: row,
      error,
    } = await sb
      .from("tasks")
      .update(patch)
      .eq(
        "id",
        data.id,
      )
      .select("*")
      .single();

    if (error || !row) {
      throw new Error(
        error?.message ??
          "Failed to update task.",
      );
    }

    await recomputePriorities(
      sb,
    );

    await recomputeGoalProgress(
      sb,
    );

    await logEvent(
      sb,
      "task_updated",
      {
        task_id: data.id,
        patch: data.patch,
      },
    );

    return row;
  });

/* -------------------------------------------------------------------------- */
/* Current Plan                                                               */
/* -------------------------------------------------------------------------- */

export const getCurrentPlan = createServerFn({
  method: "GET",
})
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    return currentPlan(
      context.supabase,
    );
  });

/* -------------------------------------------------------------------------- */
/* Next Action                                                                */
/* -------------------------------------------------------------------------- */

export const getNextAction = createServerFn({
  method: "GET",
})
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    return nextActionFor(
      context.supabase,
      new Date(),
    );
  });

/* -------------------------------------------------------------------------- */
/* Replan                                                                     */
/* -------------------------------------------------------------------------- */

export const replan = createServerFn({
  method: "POST",
})
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) =>
    z
      .object({
        available_minutes:
          z
            .number()
            .min(15)
            .max(960)
            .optional(),
      })
      .parse(
        d ?? {},
      ),
  )
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    const now = new Date();

    const minutes =
      data.available_minutes ??
      (await getAvailableMinutes(
        sb,
      ));

    const safeMinutes =
      clamp(
        minutes,
        15,
        960,
      );

    const result =
      await generatePlan(
        sb,
        {
          availableMinutes:
            safeMinutes,

          isReplan: true,

          now,
        },
      );

    await logEvent(
      sb,
      "plan_replanned",
      {
        available_minutes:
          safeMinutes,
      },
    );

    return {
      plan:
        result.plan,

      warnings:
        result.warnings ??
        [],

      next_action:
        await nextActionFor(
          sb,
          now,
        ),
    };
  });

/* -------------------------------------------------------------------------- */
/* Submit Feedback                                                            */
/* -------------------------------------------------------------------------- */

export const submitFeedback =
  createServerFn({
    method: "POST",
  })
    .middleware([
      requireSupabaseAuth,
    ])
    .validator((d: unknown) =>
      z
        .object({
          task_id:
            z.string().uuid(),

          kind:
            z.enum(
              FeedbackKinds,
            ),

          note:
            z
              .string()
              .trim()
              .max(1000)
              .optional(),

          actual_minutes:
            z
              .number()
              .min(0)
              .max(1200)
              .optional(),

          progress:
            z
              .number()
              .min(0)
              .max(100)
              .optional(),
        })
        .parse(d),
    )
    .handler(
      async ({
        data,
        context,
      }) => {
        const sb =
          context.supabase;

        const now =
          new Date();

        /*
         * Load the current task.
         */
        const tasks =
          await loadTasks(sb);

        const task =
          tasks.find(
            (t) =>
              t.id ===
              data.task_id,
          );

        if (!task) {
          throw new Error(
            "Task not found.",
          );
        }

        /*
         * Do not allow feedback against
         * an already cancelled task.
         */
        if (
          task.status ===
          "cancelled"
        ) {
          throw new Error(
            "This task is no longer active.",
          );
        }

        const previous =
          await currentPlan(sb);

        const patch: TaskUpdate =
          {};

        /* ---------------------------- */
        /* Apply feedback state          */
        /* ---------------------------- */

        switch (
          data.kind
        ) {
          case "completed": {
            patch.status =
              "completed";

            patch.progress =
              100;

            patch.completed_at =
              now.toISOString();

            break;
          }

          case "partial": {
            patch.status =
              "in_progress";

            patch.progress =
              clamp(
                Math.max(
                  task.progress,
                  data.progress ??
                    Math.min(
                      task.progress +
                        40,
                      90,
                    ),
                ),
                0,
                99,
              );

            break;
          }

          case "delayed":
          case "skipped": {
            patch.status =
              "delayed";

            patch.urgency =
              clamp(
                task.urgency + 1,
                1,
                5,
              );

            break;
          }

          case "blocked": {
            patch.status =
              "blocked";

            break;
          }

          case "not_relevant": {
            patch.status =
              "cancelled";

            patch.completed_at =
              null;

            break;
          }

          case "took_longer": {
            /*
             * Important:
             * "took_longer" should not automatically
             * mean completed if the user only reports
             * that the task is taking longer.
             *
             * Keep it in progress unless the supplied
             * progress says it is complete.
             */
            if (
              data.progress !=
                null &&
              data.progress >=
                100
            ) {
              patch.status =
                "completed";

              patch.progress =
                100;

              patch.completed_at =
                now.toISOString();
            } else {
              patch.status =
                "in_progress";

              patch.progress =
                clamp(
                  data.progress ??
                    Math.max(
                      task.progress,
                      50,
                    ),
                  0,
                  99,
                );
            }

            break;
          }
        }

        if (
          data.actual_minutes !=
          null
        ) {
          patch.actual_minutes =
            data.actual_minutes;
        }

        /* ---------------------------- */
        /* Update task                   */
        /* ---------------------------- */

        const {
          error: updateError,
        } = await sb
          .from("tasks")
          .update(patch)
          .eq(
            "id",
            data.task_id,
          );

        if (updateError) {
          throw new Error(
            updateError.message,
          );
        }

        /* ---------------------------- */
        /* Save feedback                 */
        /* ---------------------------- */

        const {
          error: feedbackError,
        } = await sb
          .from("feedback")
          .insert({
            task_id:
              data.task_id,

            kind:
              data.kind,

            note:
              data.note ??
              null,

            actual_minutes:
              data.actual_minutes ??
              null,
          });

        if (feedbackError) {
          throw new Error(
            feedbackError.message,
          );
        }

        /*
         * Recompute deterministic state before
         * asking the evaluator whether a replan
         * is necessary.
         */
        await recomputePriorities(
          sb,
        );

        await recomputeGoalProgress(
          sb,
        );

        const availableMinutes =
          await getAvailableMinutes(
            sb,
          );

        const spent =
          data.actual_minutes ??
          task.estimated_minutes;

        /*
         * Never allow remaining time to become
         * greater than the actual available time.
         *
         * The old Math.max(30, ...)
         * could incorrectly turn 10 available
         * minutes into 30 minutes.
         */
        const remainingWindow =
          clamp(
            availableMinutes -
              Math.max(
                0,
                spent,
              ),
            0,
            960,
          );

        const openTitles =
          tasks
            .filter(
              (t) =>
                t.id !==
                  task.id &&
                isOpenTask(
                  t.status,
                ),
            )
            .map(
              (t) =>
                t.title,
            );

        /* ---------------------------- */
        /* AI evaluation                 */
        /* ---------------------------- */

        const {
          evaluation,
          engine,
        } = await evaluate({
          kind:
            data.kind,

          taskTitle:
            task.title,

          estimatedMinutes:
            task.estimated_minutes,

          actualMinutes:
            data.actual_minutes ??
            null,

          note:
            data.note ??
            null,

          openTasks:
            openTitles,

          availableMinutes:
            remainingWindow,
        });

        await logEvent(
          sb,
          "feedback_received",
          {
            task_id:
              data.task_id,

            kind:
              data.kind,

            should_replan:
              evaluation.should_replan,

            remaining_minutes:
              remainingWindow,
          },
        );

        /* ---------------------------- */
        /* Replan                        */
        /* ---------------------------- */

        let planResult =
          null;

        /*
         * Only replan when:
         * 1. evaluator says yes
         * 2. there is enough time to create
         *    a useful plan
         */
        if (
          evaluation.should_replan &&
          remainingWindow >= 15
        ) {
          planResult =
            await generatePlan(
              sb,
              {
                availableMinutes:
                  remainingWindow,

                isReplan:
                  true,

                reasoning:
                  evaluation.reason,

                now,
              },
            );

          await logEvent(
            sb,
            "plan_replanned",
            {
              task_id:
                data.task_id,

              available_minutes:
                remainingWindow,

              reasoning:
                evaluation.reason,
            },
          );
        }

        const after =
          await currentPlan(sb);

        const next =
          await nextActionFor(
            sb,
            now,
          );

        return {
          evaluation,

          engine,

          replanned:
            Boolean(
              planResult,
            ),

          previous_plan_items:
            previous.items,

          plan:
            after.plan,

          plan_items:
            after.items,

          next_action:
            next,

          remaining_minutes:
            remainingWindow,
        };
      },
    );

/* -------------------------------------------------------------------------- */
/* Insights                                                                   */
/* -------------------------------------------------------------------------- */

export const getInsights = createServerFn({
  method: "GET",
})
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb =
      context.supabase;

    const tasks =
      await loadTasks(sb);

    const [
      goalsResult,
      eventsResult,
      feedbackResult,
      deadlinesResult,
    ] = await Promise.all([
      sb
        .from("goals")
        .select("*"),

      sb
        .from("activity_events")
        .select(
          "event_type,created_at",
        )
        .order(
          "created_at",
          {
            ascending: false,
          },
        )
        .limit(500),

      sb
        .from("feedback")
        .select("*"),

      sb
        .from("deadlines")
        .select("*")
        .gte(
          "due_at",
          new Date().toISOString(),
        )
        .order("due_at")
        .limit(8),
    ]);

    if (goalsResult.error) {
      throw new Error(
        goalsResult.error.message,
      );
    }

    if (eventsResult.error) {
      throw new Error(
        eventsResult.error.message,
      );
    }

    if (feedbackResult.error) {
      throw new Error(
        feedbackResult.error.message,
      );
    }

    if (deadlinesResult.error) {
      throw new Error(
        deadlinesResult.error.message,
      );
    }

    const goals =
      goalsResult.data ??
      [];

    const events =
      eventsResult.data ??
      [];

    const feedback =
      feedbackResult.data ??
      [];

    const deadlines =
      deadlinesResult.data ??
      [];

    const completed =
      tasks.filter(
        (t) =>
          t.status ===
          "completed",
      );

    const withBoth =
      tasks.filter(
        (t) =>
          t.actual_minutes !=
            null &&
          t.estimated_minutes >
            0,
      );

    /*
     * Accuracy should describe how close
     * estimates are to actual time.
     *
     * Example:
     * estimated = 60
     * actual = 60
     * accuracy = 100
     */
    const estimateAccuracy =
      withBoth.length
        ? Math.round(
            withBoth.reduce(
              (sum, task) => {
                const estimated =
                  task.estimated_minutes;

                const actual =
                  task.actual_minutes ??
                  0;

                if (
                  actual <=
                  0
                ) {
                  return sum;
                }

                const ratio =
                  Math.min(
                    estimated /
                      actual,
                    actual /
                      estimated,
                  );

                return (
                  sum +
                  ratio
                );
              },
              0,
            ) /
              withBoth.length *
              100,
          )
        : null;

    return {
      total_tasks:
        tasks.length,

      completed:
        completed.length,

      delayed:
        tasks.filter(
          (t) =>
            t.status ===
            "delayed",
        ).length,

      blocked:
        tasks.filter(
          (t) =>
            t.status ===
            "blocked",
        ).length,

      open:
        tasks.filter(
          (t) =>
            isOpenTask(
              t.status,
            ),
        ).length,

      completion_rate:
        tasks.length
          ? Math.round(
              (completed.length /
                tasks.length) *
                100,
            )
          : 0,

      estimate_accuracy:
        estimateAccuracy,

      replans:
        events.filter(
          (e) =>
            e.event_type ===
            "plan_replanned",
        ).length,

      feedback_count:
        feedback.length,

      goals:
        goals.map((g) => ({
          id: g.id,
          title: g.title,
          progress: g.progress,
        })),

      upcoming:
        deadlines,

      estimated_vs_actual:
        withBoth.map((t) => ({
          title:
            t.title,

          estimated:
            t.estimated_minutes,

          actual:
            t.actual_minutes ??
            0,
        })),

      activity:
        events.slice(
          0,
          12,
        ),
    };
  });

/* -------------------------------------------------------------------------- */
/* Load Demo Scenario                                                         */
/* -------------------------------------------------------------------------- */

export const loadDemoScenario =
  createServerFn({
    method: "POST",
  })
    .middleware([
      requireSupabaseAuth,
    ])
    .handler(
      async ({
        context,
      }) => {
        await logEvent(
          context.supabase,
          "demo_loaded",
          {},
        );

        return {
          raw_input:
            DEMO_INPUT,
        };
      },
    );

/* -------------------------------------------------------------------------- */
/* Reset Workspace                                                            */
/* -------------------------------------------------------------------------- */

export const resetWorkspace =
  createServerFn({
    method: "POST",
  })
    .middleware([
      requireSupabaseAuth,
    ])
    .handler(
      async ({
        context,
      }) => {
        const sb =
          context.supabase;

        const uid =
          context.userId;

        /*
         * Delete children before parents.
         * This avoids foreign-key failures.
         */
        const tables = [
          "plan_items",
          "plans",
          "feedback",
          "deadlines",
          "tasks",
          "goals",
          "contexts",
        ] as const;

        for (
          const table of tables
        ) {
          const {
            error,
          } = await sb
            .from(table)
            .delete()
            .eq(
              "user_id",
              uid,
            );

          if (error) {
            console.error(
              `[lifeos.api] reset failed for ${table}`,
              error,
            );

            throw new Error(
              `Failed to reset ${table}: ${error.message}`,
            );
          }
        }

        await logEvent(
          sb,
          "workspace_reset",
          {},
        );

        return {
          ok: true,
        };
      },
    );