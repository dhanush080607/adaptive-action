import type { ContextExtraction } from "./types";

const WEEKDAYS = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];

/**
 * Resolve common natural-language date phrases into a real timestamp.
 */
export function resolveDatePhrase(
  phrase: string,
  now = new Date(),
): string | null {
  const p = phrase.toLowerCase().trim();

  if (!p) return null;

  const at = (date: Date, hour: number) => {
    const copy = new Date(date);
    copy.setHours(hour, 0, 0, 0);
    return copy.toISOString();
  };

  // Explicit ISO/date formats.
  const parsed = Date.parse(phrase);

  if (
    !Number.isNaN(parsed) &&
    /\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}/.test(phrase)
  ) {
    return new Date(parsed).toISOString();
  }

  // Relative dates.
  if (/\btonight\b|\btoday\b/.test(p)) {
    return at(now, 23);
  }

  if (/\btomorrow\b/.test(p)) {
    return at(new Date(now.getTime() + 86400000), 23);
  }

  const inDays = p.match(/in\s+(\d+)\s+days?/);
  if (inDays) {
    return at(
      new Date(now.getTime() + Number(inDays[1]) * 86400000),
      23,
    );
  }

  const inWeeks = p.match(/in\s+(\d+)\s+weeks?/);
  if (inWeeks) {
    return at(
      new Date(now.getTime() + Number(inWeeks[1]) * 7 * 86400000),
      23,
    );
  }

  if (/\bnext week\b/.test(p)) {
    return at(new Date(now.getTime() + 7 * 86400000), 23);
  }

  // Weekday names.
  for (let i = 0; i < WEEKDAYS.length; i++) {
    if (p.includes(WEEKDAYS[i]!)) {
      let delta = (i - now.getDay() + 7) % 7;

      // If today is mentioned, interpret it as the next occurrence.
      if (delta === 0) {
        delta = 7;
      }

      return at(
        new Date(now.getTime() + delta * 86400000),
        18,
      );
    }
  }

  return null;
}

/**
 * Extract available time such as:
 * "I have 2 hours tonight"
 * "I have 90 minutes available"
 * "3 hours free today"
 */
function extractMinutes(
  text: string,
): { label: string; minutes: number }[] {
  const out: { label: string; minutes: number }[] = [];

  const regex =
    /(\d+(?:\.\d+)?)\s*(hours?|hrs?|h|minutes?|mins?)\b([^\.\n]{0,40})/gi;

  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    const value = Number(match[1]);

    if (!Number.isFinite(value) || value <= 0) {
      continue;
    }

    const unit = (match[2] ?? "").toLowerCase();

    const minutes = unit.startsWith("h")
      ? Math.round(value * 60)
      : Math.round(value);

    const tail = (match[3] ?? "").trim();
    const context = match[0].trim();

    if (
      /tonight|today|available|free|left|this evening|now/i.test(
        `${tail} ${context}`,
      )
    ) {
      out.push({
        label: context.slice(0, 60),
        minutes,
      });
    }
  }

  return out;
}

/**
 * Deterministic local context extraction.
 *
 * Used only when the AI service is unavailable.
 * The UI should label this output as the local fallback engine.
 */
export function localExtractContext(
  raw: string,
  now = new Date(),
): ContextExtraction {
  const lines = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const tasks: ContextExtraction["tasks"] = [];
  const goals: ContextExtraction["goals"] = [];
  const deadlines: ContextExtraction["deadlines"] = [];
  const constraints: string[] = [];
  const progress: ContextExtraction["progress"] = [];

  const pushTask = (
    title: string,
    opts: Partial<ContextExtraction["tasks"][number]> = {},
  ) => {
    const clean = title
      .replace(/^[-*•\d.)\s]+/, "")
      .replace(/[.,;:]+$/, "")
      .trim();

    if (clean.length < 2 || clean.length > 140) {
      return;
    }

    if (
      tasks.some(
        (task) => task.title.toLowerCase() === clean.toLowerCase(),
      )
    ) {
      return;
    }

    tasks.push({
      title: clean,
      description: "",
      goal_title: opts.goal_title ?? "",
      importance: opts.importance ?? 3,
      urgency: opts.urgency ?? 3,
      estimated_minutes: opts.estimated_minutes ?? 45,
      progress: opts.progress ?? 0,
      status: opts.status ?? "pending",
      deadline_text: opts.deadline_text ?? "",
      depends_on_titles: [],
      certainty: opts.certainty ?? "inferred",
    });
  };

  let currentGoal = "";

  for (const line of lines) {
    const isBullet =
      /^[-*•]/.test(line) ||
      /^\d+[.)]/.test(line);

    const lower = line.toLowerCase();

    const due = resolveDatePhrase(line, now);

    // Deadline detection.
    if (due && !isBullet) {
      deadlines.push({
        title: line.replace(/[.]+$/, "").slice(0, 120),
        due_at: due,
        due_text: line.slice(0, 80),
        importance: 4,
        related_task_title: "",
      });
    }

    // Bullet/list item -> likely task.
    if (isBullet) {
      pushTask(line, {
        goal_title: currentGoal,
        deadline_text: line,
      });

      continue;
    }

    // Goal-like language.
    if (
      /(study|prepare|revise|learn|exam|goal|project|master)/i.test(
        lower,
      )
    ) {
      const title = line
        .replace(/[:.]+$/, "")
        .slice(0, 120);

      if (
        title.length >= 2 &&
        !goals.some(
          (goal) =>
            goal.title.toLowerCase() === title.toLowerCase(),
        )
      ) {
        goals.push({
          title,
          description: "",
          importance: 4,
          deadline_text: line,
          certainty: "inferred",
        });
      }

      currentGoal = title;
    }

    // Task-like language.
    if (
      /(need to|have to|must|due|finish|complete|submit|assignment|todo)/i.test(
        lower,
      )
    ) {
      const pctMatch = lower.match(/(\d{1,3})\s*%/);

      const taskTitle = line
        .replace(/^[-*•\d.)\s]+/, "")
        .slice(0, 130);

      pushTask(taskTitle, {
        progress: pctMatch
          ? Math.min(100, Number(pctMatch[1]))
          : 0,
        importance: 4,
        urgency:
          /tomorrow|tonight|today/.test(lower)
            ? 5
            : 3,
        deadline_text: line,
      });

      if (pctMatch) {
        progress.push({
          task: taskTitle.slice(0, 60),
          percent: Math.min(
            100,
            Number(pctMatch[1]),
          ),
        });
      }
    }

    // Completed task detection.
    if (
      /(already\s+(completed|finished|done)|i\s+(completed|finished|done))/i.test(
        lower,
      )
    ) {
      const completedTitle = line
        .replace(
          /.*?(already\s+)?(completed|finished|done)\b/i,
          "",
        )
        .replace(/^[:\-–—\s]+/, "")
        .trim();

      pushTask(
        completedTitle || line,
        {
          status: "completed",
          progress: 100,
          importance: 3,
          urgency: 1,
          certainty: "explicit",
        },
      );
    }

    // Available-time / constraint detection.
    if (
      /(only|have|available|left|free)/i.test(lower) &&
      /\d/.test(lower)
    ) {
      constraints.push(line.slice(0, 140));
    }
  }

  const available = extractMinutes(raw);

  return {
    context_summary:
      `Local fallback reading: ${tasks.length} task(s), ` +
      `${goals.length} goal(s), ` +
      `${deadlines.length} deadline(s) detected from your input.`,

    goals,

    tasks,

    deadlines,

    constraints: Array.from(new Set(constraints)),

    available_time: available,

    dependencies: [],

    progress,

    open_questions:
      tasks.length === 0
        ? [
            "I couldn't confidently detect any tasks — can you list them?",
          ]
        : [],
  };
}