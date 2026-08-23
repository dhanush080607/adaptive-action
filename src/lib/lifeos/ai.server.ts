import { z } from "zod";

const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-3.7-flash";

export class AiUnavailableError extends Error {
  constructor(
    message: string,
    public code: string,
  ) {
    super(message);
    this.name = "AiUnavailableError";
  }
}

function friendly(status: number): { message: string; code: string } {
  if (status === 401 || status === 403)
    return { message: "AI service is not authorised right now.", code: "AI_AUTH" };
  if (status === 402)
    return { message: "AI credits are exhausted for this workspace.", code: "AI_CREDITS" };
  if (status === 429)
    return { message: "AI service is rate limited. Try again in a moment.", code: "AI_RATE_LIMIT" };
  if (status >= 500) return { message: "AI service is temporarily down.", code: "AI_UPSTREAM" };
  return { message: "AI request was rejected.", code: "AI_BAD_REQUEST" };
}

/**
 * Single AI entry point. Always requests strict JSON and validates it with Zod.
 * Throws AiUnavailableError so callers can drop to deterministic fallbacks.
 */
export async function generateStructured<T>(args: {
  schema: z.ZodType<T>;
  jsonSchema: Record<string, unknown>;
  system: string;
  user: string;
  schemaName: string;
}): Promise<T> {
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) throw new AiUnavailableError("AI is not configured.", "AI_NOT_CONFIGURED");

  const body = {
    model: MODEL,
    messages: [
      { role: "system", content: args.system },
      { role: "user", content: args.user },
    ],
    response_format: {
      type: "json_schema",
      json_schema: { name: args.schemaName, strict: false, schema: args.jsonSchema },
    },
  };

  const attempt = async (): Promise<string> => {
    const res = await fetch(GATEWAY, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": key },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(45_000),
    });
    if (!res.ok) {
      const f = friendly(res.status);
      console.error("[lifeos.ai] gateway error", res.status, f.code);
      const err = new AiUnavailableError(f.message, f.code);
      // Only rate limits and upstream failures are worth another attempt.
      (err as AiUnavailableError & { retryable?: boolean; retryAfterMs?: number }).retryable =
        res.status === 429 || res.status >= 500;
      const retryAfter = Number(res.headers.get("retry-after"));
      if (Number.isFinite(retryAfter) && retryAfter > 0) {
        (err as AiUnavailableError & { retryAfterMs?: number }).retryAfterMs = Math.min(
          retryAfter * 1000,
          5000,
        );
      }
      throw err;
    }
    const json = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const content = json.choices?.[0]?.message?.content;
    if (!content) throw new AiUnavailableError("AI returned an empty response.", "AI_EMPTY");
    return content;
  };

  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
  let lastError: unknown;
  for (let i = 0; i < 2; i++) {
    if (i > 0) await sleep(600);
    try {
      const content = await attempt();
      const cleaned = content
        .replace(/^```(?:json)?/i, "")
        .replace(/```$/, "")
        .trim();
      const parsed = args.schema.safeParse(JSON.parse(cleaned));
      if (parsed.success) return parsed.data;
      lastError = new AiUnavailableError("AI response failed validation.", "AI_INVALID_SHAPE");
      console.error("[lifeos.ai] invalid shape", parsed.error.issues.slice(0, 3));
    } catch (err) {
      lastError = err;
      if (err instanceof AiUnavailableError) {
        const meta = err as AiUnavailableError & { retryable?: boolean; retryAfterMs?: number };
        // Terminal statuses (400/401/402/403) must never be re-sent.
        if (meta.retryable === false) throw err;
        if (meta.retryable && meta.retryAfterMs) await sleep(meta.retryAfterMs);
      }
      console.error("[lifeos.ai] attempt failed", (err as Error).message);
    }
  }
  if (lastError instanceof AiUnavailableError) throw lastError;
  throw new AiUnavailableError("AI response could not be understood.", "AI_INVALID_JSON");
}
