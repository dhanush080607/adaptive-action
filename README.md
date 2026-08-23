# LifeOS — AI Action System

LifeOS turns messy, scattered information (deadlines, half-finished work, "I only have 3 hours
tonight") into a structured context, a realistic plan and one clear next action.

## How it works

1. **Capture** — you dump raw text on the Capture screen.
2. **Context engine** — an AI pass extracts goals, tasks, deadlines, dependencies, progress and
   time constraints. Anything not stated explicitly is flagged as inferred or uncertain. If AI is
   unavailable, a deterministic local parser takes over and the UI says so.
3. **Priority engine** (`src/lib/lifeos/priority.ts`) — a deterministic, explainable 0–100 score
   from deadline pressure, importance, urgency, dependencies, blocking impact, effort and progress.
   AI never sets the score; it only supplies the signals.
4. **Planner** (`src/lib/lifeos/planner.ts`) — fits the highest-scoring actionable work into your
   real available window, inserts breaks, and explicitly defers what does not fit.
5. **Next action** — exactly one recommendation, with the factors behind it and a confidence value.
6. **Feedback loop** — report what actually happened (completed, partial, delayed, took longer,
   blocked, not relevant). LifeOS evaluates the impact and rebuilds the plan around the time you
   have left.

## Stack

- TanStack Start (React 19, Vite, file-based routing) with server functions for all backend logic
- Lovable Cloud (Postgres, auth, row-level security)
- Lovable AI gateway (Gemini) with strict JSON-schema validation and deterministic fallbacks
- Tailwind CSS v4 + shadcn/ui, Framer Motion, canvas ambient visuals

## Routes

| Route | Purpose |
| --- | --- |
| `/` | Landing page |
| `/auth` | Email/password and Google sign-in |
| `/dashboard` | Next action, today's plan, priority queue, signals |
| `/capture` | Raw information capture and AI processing |
| `/context` | Review of what LifeOS understood before it changes anything |
| `/plan` | Full session plan with reality-check warnings |
| `/insights` | Completion rate, estimate accuracy, goal progress, danger zone |
| `/tasks/$id` | Single task detail and manual edits |

## Development

```sh
npm i
npm run dev
```

Auth-protected pages live under `src/routes/_authenticated/`. All data access runs through
authenticated server functions in `src/lib/lifeos/api.functions.ts`; every table is protected by
row-level security scoped to the signed-in user.
