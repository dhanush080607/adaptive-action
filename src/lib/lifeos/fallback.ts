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

/** Resolve common natural-language date phrases into a real timestamp. */
export function resolveDatePhrase(phrase: string, now = new Date()): string | null {
  const p = phrase.toLowerCase().trim();
  if (!p) return null;
  const at = (d: Date, h: number) => {
    const c = new Date(d);
    c.setHours(h, 0, 0, 0);
    return c.toISOString();
  };

  const iso = Date.parse(phrase);
  if (!Number.isNaN(iso) && /\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}/.test(phrase)) {
    return new Date(iso).toISOString();
  }
  if (/\btonight\b|\btoday\b/.test(p)) return at(now, 23);
  if (/\btomorrow\b/.test(p)) return at(new Date(now.getTime() + 86400000), 23);
  const inDays = p.match(/in\s+(\d+)\s+day/);
  if (inDays) return at(new Date(now.getTime() + Number(inDays[1]) * 86400000), 23);
  const inWeeks = p.match(/in\s+(\d+)\s+week/);
  if (inWeeks) return at(new Date(now.getTime() + Number(inWeeks[1]) * 7 * 86400000), 23);
  if (/next week/.test(p)) return at(new Date(now.getTime() + 7 * 86400000), 23);
  for (let i = 0; i < WEEKDAYS.length; i++) {
    if (p.includes(WEEKDAYS[i]!)) {
      let delta = (i - now.getDay() + 7) % 7;
      if (delta === 0) delta = 7;
      return at(new Date(now.getTime() + delta * 86400000), 18);
    }
  }
  return null;
}

function extractMinutes(text: string): { label: string; minutes: number }[] {
  const out: { label: string; minutes: number }[] = [];
  const re = /(\d+(?:\.\d+)?)\s*(hours?|hrs?|h|minutes?|mins?)\b([^.\n]{0,40})/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const value = Number(m[1]);
    const unit = (m[2] ?? "").toLowerCase();
    const minutes = unit.startsWith("h") ? Math.round(value * 60) : Math.round(value);
    const tail = (m[3] || "").trim();
    const context = `${m[0]}`.trim();
    if (/tonight|today|available|free|left|this evening|now/i.test(`${tail} ${context}`)) {
      out.push({ label: context.slice(0, 60), minutes });
    }
  }
  return out;
}

/**
 * Deterministic local context extraction. Used only when the AI service is
 * unavailable — the UI always labels this output as the local fallback engine.
 */
export function localExtractContext(raw: string, now = new Date()): ContextExtraction {
  const lines = raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const tasks: ContextExtraction["tasks"] = [];
  const goals: ContextExtraction["goals"] = [];
  const deadlines: ContextExtraction["deadlines"] = [];
  const constraints: string[] = [];
  const progress: ContextExtraction["progress"] = [];

  const pushTask = (title: string, opts: Partial<ContextExtraction["tasks"][number]> = {}) => {
    const clean = title.replace(/^[-*•\d.)\s]+/, "").replace(/[.,;:]+$/, "").trim();
    if (clean.length < 2 || clean.length > 140) return;
    if (tasks.some((t) => t.title.toLowerCase() === clean.toLowerCase())) return;
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
      certainty: "inferred",
    });
  };

  let currentGoal = "";
  for (const line of lines) {
    const isBullet = /^[-*•]|^\d+[.)]/.test(line);
    const lower = line.toLowerCase();

    const due = resolveDatePhrase(line, now);
    if (due && !isBullet) {
      deadlines.push({
        title: line.replace(/[.]+$/, "").slice(0, 120),
        due_at: due,
        due_text: line.slice(0, 80),
        importance: 4,
        related_task_title: "",
      });
    }

    if (isBullet) {
      pushTask(line, { goal_title: currentGoal, deadline_text: currentGoal });
      continue;
    }

    if (/(study|prepare|revise|learn|exam|goal|project|master)/i.test(lower)) {
      const title = line.replace(/[:.]+$/, "").slice(0, 120);
      if (!goals.some((g) => g.title === title)) {
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

    if (/(need to|have to|must|due|finish|complete|submit|assignment|todo)/i.test(lower)) {
      const pct = lower.match(/(\d{1,3})\s*%/);
      pushTask(line.slice(0, 130), {
        progress: pct ? Math.min(100, Number(pct[1])) : 0,
        importance: 4,
        urgency: /tomorrow|tonight|today/.test(lower) ? 5 : 3,
        deadline_text: line,
      });
      if (pct) progress.push({ task: line.slice(0, 60), percent: Number(pct[1]) });
    }

    if (/(already (completed|finished|done)|i (completed|finished))/i.test(lower)) {
      pushTask(line.replace(/.*?(already )?(completed|finished|done)/i, "").slice(0, 120), {
        status: "completed",
        progress: 100,
      });
    }

    if (/(only|have|available|left|free)/i.test(lower) && /\d/.test(lower)) {
      constraints.push(line.slice(0, 140));
    }
  }

  const available = extractMinutes(raw);

  return {
    context_summary:
      `Local fallback reading: ${tasks.length} task(s), ${goals.length} goal(s), ` +
      `${deadlines.length} deadline(s) detected from your input.`,
    goals,
    tasks,
    deadlines,
    constraints: Array.from(new Set(constraints)),
    available_time: available,
    dependencies: [],
    progress,
    open_questions:
      tasks.length === 0 ? ["I couldn't confidently detect any tasks — can you list them?"] : [],
  };
}
