/**
 * The only place that talks to Gemini.
 *
 * `fetch` is injectable so every branch — success, HTTP error, malformed body, empty
 * candidate, timeout — is exercised by unit tests without a key and without a network.
 * That matters more than usual here: this environment cannot reach the API at all, so
 * the tests are the only evidence the client is correct until it is deployed.
 */

import { geminiApiKey, geminiModel } from "@/lib/ai/config";

export type GeminiRequest = {
  systemInstruction: string;
  prompt: string;
  /** Gemini's `responseSchema`; forces structured output. */
  responseSchema: unknown;
  temperature: number;
  maxOutputTokens: number;
  timeoutMs: number;
};

export type GeminiUsage = {
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens: number;
};

export type GeminiSuccess = {
  ok: true;
  text: string;
  usage: GeminiUsage;
  latencyMs: number;
};

export type GeminiFailure = {
  ok: false;
  /** For the ledger and the logs; never shown to a student. */
  reason: "no-key" | "http" | "timeout" | "malformed" | "blocked" | "network";
  detail: string;
  status?: number;
  latencyMs: number;
};

export type GeminiResponse = GeminiSuccess | GeminiFailure;

export type Transport = typeof fetch;

const ENDPOINT = (model: string) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;

type Deps = {
  fetchImpl?: Transport;
  apiKey?: string | null;
  model?: string;
  now?: () => number;
};

/**
 * Pulls the text out of a `generateContent` reply.
 *
 * Structured output still arrives as text inside a part; the schema constrains what
 * that text contains, not the envelope it arrives in.
 */
function extractText(body: unknown): { text: string | null; blocked: string | null } {
  if (typeof body !== "object" || body === null) return { text: null, blocked: null };

  const root = body as Record<string, unknown>;

  const promptFeedback = root.promptFeedback as { blockReason?: string } | undefined;
  if (promptFeedback?.blockReason) {
    return { text: null, blocked: promptFeedback.blockReason };
  }

  const candidates = root.candidates;
  if (!Array.isArray(candidates) || candidates.length === 0) {
    return { text: null, blocked: null };
  }

  const first = candidates[0] as {
    content?: { parts?: Array<{ text?: unknown }> };
    finishReason?: string;
  };

  /*
   * Anything other than a clean stop means the reply is not whole. SAFETY and
   * RECITATION come back with nothing; MAX_TOKENS comes back with truncated JSON,
   * which is worse — it looks like an answer and parses like rubbish. Both are
   * failures here rather than further down, so the ledger records the real reason
   * instead of blaming the schema and burning a retry.
   */
  if (first.finishReason && first.finishReason !== "STOP") {
    return { text: null, blocked: first.finishReason };
  }

  const parts = first.content?.parts;
  if (!Array.isArray(parts)) return { text: null, blocked: null };

  const text = parts
    .map((part) => (typeof part.text === "string" ? part.text : ""))
    .join("")
    .trim();

  return { text: text.length > 0 ? text : null, blocked: null };
}

function readUsage(body: unknown): GeminiUsage {
  const meta = (body as { usageMetadata?: Record<string, unknown> } | null)?.usageMetadata;
  const num = (value: unknown): number =>
    typeof value === "number" && Number.isFinite(value) && value >= 0 ? Math.trunc(value) : 0;

  return {
    inputTokens: num(meta?.promptTokenCount),
    outputTokens: num(meta?.candidatesTokenCount),
    cachedInputTokens: num(meta?.cachedContentTokenCount),
  };
}

export async function callGemini(
  request: GeminiRequest,
  deps: Deps = {},
): Promise<GeminiResponse> {
  const now = deps.now ?? (() => Date.now());
  const started = now();
  const elapsed = () => Math.max(0, now() - started);

  const key = deps.apiKey !== undefined ? deps.apiKey : geminiApiKey();
  if (!key) {
    return { ok: false, reason: "no-key", detail: "GEMINI_API_KEY is not set", latencyMs: 0 };
  }

  const model = deps.model ?? geminiModel();
  const fetchImpl = deps.fetchImpl ?? fetch;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), request.timeoutMs);

  try {
    const response = await fetchImpl(ENDPOINT(model), {
      method: "POST",
      signal: controller.signal,
      headers: {
        "content-type": "application/json",
        // Header rather than a query parameter, so the key cannot end up in a log line.
        "x-goog-api-key": key,
      },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: request.systemInstruction }] },
        contents: [{ role: "user", parts: [{ text: request.prompt }] }],
        generationConfig: {
          temperature: request.temperature,
          maxOutputTokens: request.maxOutputTokens,
          responseMimeType: "application/json",
          responseSchema: request.responseSchema,
        },
      }),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      return {
        ok: false,
        reason: "http",
        status: response.status,
        detail: detail.slice(0, 500),
        latencyMs: elapsed(),
      };
    }

    let body: unknown;
    try {
      body = await response.json();
    } catch {
      return {
        ok: false,
        reason: "malformed",
        detail: "body was not JSON",
        latencyMs: elapsed(),
      };
    }

    const { text, blocked } = extractText(body);

    if (text === null) {
      return {
        ok: false,
        reason: blocked ? "blocked" : "malformed",
        detail: blocked ?? "no text in the first candidate",
        latencyMs: elapsed(),
      };
    }

    return { ok: true, text, usage: readUsage(body), latencyMs: elapsed() };
  } catch (error) {
    const aborted = error instanceof Error && error.name === "AbortError";
    return {
      ok: false,
      reason: aborted ? "timeout" : "network",
      detail: error instanceof Error ? error.message : String(error),
      latencyMs: elapsed(),
    };
  } finally {
    clearTimeout(timer);
  }
}
