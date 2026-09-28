/**
 * AI configuration.
 *
 * One provider, one model (D8). The key is read lazily rather than captured at module
 * load: the app has to boot and be fully usable without it, both locally and in CI, and
 * a missing key is a degraded mode rather than a crash (doc 06 §5).
 *
 * Deliberately free of `server-only` so the pure cost and quota maths can be unit
 * tested, but nothing here should ever be imported from a client component.
 */

const int = (value: string | undefined, fallback: number): number => {
  const parsed = Number.parseInt((value ?? "").trim(), 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
};

const float = (value: string | undefined, fallback: number): number => {
  const parsed = Number.parseFloat((value ?? "").trim());
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
};

/** Pinned via env so the model can be rolled forward without a deploy (doc 06). */
export const geminiModel = (): string => process.env.GEMINI_MODEL?.trim() || "gemini-3.8-flash";

/** Null when unset, which puts every AI path into deterministic fallback. */
export const geminiApiKey = (): string | null => process.env.GEMINI_API_KEY?.trim() || null;

export const hasGeminiKey = (): boolean => geminiApiKey() !== null;

export const aiLimits = () => ({
  /** Marked responses per student per day before degrading to fallback. */
  dailyMarks: int(process.env.AI_DAILY_MARK_LIMIT, 60),
  /** Tutor turns per student per day. */
  dailyTutorTurns: int(process.env.AI_DAILY_TUTOR_LIMIT, 25),
  /** Whole-app spend ceiling for the calendar month, in US dollars. */
  monthlyCeilingUsd: float(process.env.AI_MONTHLY_COST_CEILING_USD, 50),
});

/**
 * Output tokens cost five times input, so a runaway response is the expensive failure
 * mode. Capped per feature rather than globally (doc 06 §6).
 */
export const MAX_OUTPUT_TOKENS = {
  mark: 1200,
  markBatch: 8000,
  blurt: 900,
  tutor: 700,
} as const;

/** Marking must be reproducible: same answer, same mark. */
export const MARK_TEMPERATURE = 0;

/** One retry on a schema violation, then deterministic fallback (doc 06 §1). */
export const MARK_SCHEMA_RETRIES = 1;

/** Beyond this the request is abandoned and the fallback answers instead. */
export const MARK_TIMEOUT_MS = int(process.env.AI_MARK_TIMEOUT_MS, 15_000);
