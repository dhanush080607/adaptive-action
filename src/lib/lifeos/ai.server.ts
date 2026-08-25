import { z } from "zod";

const GATEWAY =
  "https://ai.gateway.lovable.dev/v1/chat/completions";

/**
 * Keep this model aligned with the model enabled
 * for your Lovable AI gateway.
 */
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

type RetryMeta = {
  retryable?: boolean;
  retryAfterMs?: number;
};

function friendly(status: number): {
  message: string;
  code: string;
} {
  if (status === 401 || status === 403) {
    return {
      message:
        "AI service is not authorised right now.",
      code: "AI_AUTH",
    };
  }

  if (status === 402) {
    return {
      message:
        "AI credits are exhausted for this workspace.",
      code: "AI_CREDITS",
    };
  }

  if (status === 429) {
    return {
      message:
        "AI service is rate limited. Try again in a moment.",
      code: "AI_RATE_LIMIT",
    };
  }

  if (status >= 500) {
    return {
      message:
        "AI service is temporarily down.",
      code: "AI_UPSTREAM",
    };
  }

  return {
    message:
      "AI request was rejected.",
    code: "AI_BAD_REQUEST",
  };
}

function withRetryMeta(
  error: AiUnavailableError,
  meta: RetryMeta,
): AiUnavailableError {
  Object.assign(error, meta);
  return error;
}

/**
 * Single AI entry point.
 *
 * Responsibilities:
 * - Call Lovable AI gateway
 * - Request structured JSON
 * - Validate response with Zod
 * - Retry transient failures
 * - Convert gateway errors into application errors
 */
export async function generateStructured<T>(args: {
  schema: z.ZodType<T>;
  jsonSchema: Record<string, unknown>;
  system: string;
  user: string;
  schemaName: string;
}): Promise<T> {
  const key = process.env["LOVABLE_API_KEY"];

  if (!key) {
    throw new AiUnavailableError(
      "AI is not configured.",
      "AI_NOT_CONFIGURED",
    );
  }

  const body = {
    model: MODEL,

    messages: [
      {
        role: "system",
        content: args.system,
      },
      {
        role: "user",
        content: args.user,
      },
    ],

    response_format: {
      type: "json_schema",
      json_schema: {
        name: args.schemaName,
        strict: false,
        schema: args.jsonSchema,
      },
    },
  };

  const attempt = async (): Promise<string> => {
    let response: Response;

    try {
      response = await fetch(GATEWAY, {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
          "Lovable-API-Key": key,
        },

        body: JSON.stringify(body),

        signal: AbortSignal.timeout(45_000),
      });
    } catch (error) {
      console.error(
        "[lifeos.ai] network error",
        error,
      );

      const err = new AiUnavailableError(
        "Unable to reach the AI service.",
        "AI_NETWORK",
      );

      return Promise.reject(
        withRetryMeta(err, {
          retryable: true,
        }),
      );
    }

    if (!response.ok) {
      const friendlyError = friendly(
        response.status,
      );

      console.error(
        "[lifeos.ai] gateway error",
        response.status,
        friendlyError.code,
      );

      const retryable =
        response.status === 429 ||
        response.status >= 500;

      const retryAfterHeader =
        response.headers.get("retry-after");

      const retryAfter =
        retryAfterHeader
          ? Number(retryAfterHeader)
          : NaN;

      const retryAfterMs =
        Number.isFinite(retryAfter) &&
        retryAfter > 0
          ? Math.min(
              retryAfter * 1000,
              5000,
            )
          : undefined;

      const error =
        new AiUnavailableError(
          friendlyError.message,
          friendlyError.code,
        );

      /**
       * With exactOptionalPropertyTypes enabled,
       * we must not explicitly assign undefined
       * to an optional property.
       */
      const retryMeta: RetryMeta = {
        retryable,
      };

      if (retryAfterMs !== undefined) {
        retryMeta.retryAfterMs =
          retryAfterMs;
      }

      throw withRetryMeta(
        error,
        retryMeta,
      );
    }

    let json: {
      choices?: Array<{
        message?: {
          content?: string;
        };
      }>;
    };

    try {
      json =
        (await response.json()) as typeof json;
    } catch (error) {
      console.error(
        "[lifeos.ai] invalid gateway JSON",
        error,
      );

      throw new AiUnavailableError(
        "AI service returned an invalid response.",
        "AI_INVALID_RESPONSE",
      );
    }

    const content =
      json.choices?.[0]?.message?.content;

    if (!content) {
      throw new AiUnavailableError(
        "AI returned an empty response.",
        "AI_EMPTY",
      );
    }

    return content;
  };

  const sleep = (ms: number) =>
    new Promise<void>((resolve) =>
      setTimeout(resolve, ms),
    );

  let lastError: unknown;

  /**
   * Two total attempts:
   *
   * 1. Normal request
   * 2. Retry when the failure is transient
   */
  for (
    let attemptNumber = 0;
    attemptNumber < 2;
    attemptNumber++
  ) {
    if (attemptNumber > 0) {
      await sleep(600);
    }

    try {
      const content =
        await attempt();

      const cleaned = content
        .replace(/^```(?:json)?/i, "")
        .replace(/```$/i, "")
        .trim();

      let parsedJson: unknown;

      try {
        parsedJson =
          JSON.parse(cleaned);
      } catch (error) {
        console.error(
          "[lifeos.ai] invalid JSON",
          error,
        );

        lastError =
          new AiUnavailableError(
            "AI returned invalid JSON.",
            "AI_INVALID_JSON",
          );

        continue;
      }

      const parsed =
        args.schema.safeParse(
          parsedJson,
        );

      if (parsed.success) {
        return parsed.data;
      }

      console.error(
        "[lifeos.ai] invalid shape",
        parsed.error.issues.slice(
          0,
          3,
        ),
      );

      lastError =
        new AiUnavailableError(
          "AI response failed validation.",
          "AI_INVALID_SHAPE",
        );

      continue;
    } catch (error) {
      lastError = error;

      if (
        error instanceof
        AiUnavailableError
      ) {
        const meta =
          error as AiUnavailableError &
            RetryMeta;

        /**
         * Do not retry terminal errors:
         * 400, 401, 402, 403, etc.
         */
        if (
          meta.retryable === false
        ) {
          throw error;
        }

        /**
         * Respect the gateway retry-after
         * value when available.
         */
        if (
          meta.retryable &&
          meta.retryAfterMs !==
            undefined
        ) {
          await sleep(
            meta.retryAfterMs,
          );
        }
      }

      console.error(
        "[lifeos.ai] attempt failed",
        error instanceof Error
          ? error.message
          : error,
      );
    }
  }

  if (
    lastError instanceof
    AiUnavailableError
  ) {
    throw lastError;
  }

  throw new AiUnavailableError(
    "AI response could not be understood.",
    "AI_INVALID_RESPONSE",
  );
}