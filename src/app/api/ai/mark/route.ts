/**
 * POST /api/ai/mark — mark one open response (doc 06 §1).
 *
 * The client sends only a question id and the answer. Everything the marker sees —
 * the stem, the mark scheme, the spec points — is assembled server-side, so a
 * student cannot supply their own mark scheme or claim a question is worth more
 * than it is.
 */

import { NextResponse } from "next/server";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth/session";
import { markAnswer } from "@/lib/marking/service";
import { rateLimit } from "@/lib/rate-limit";

const bodySchema = z.object({
  questionId: z.string().min(1).max(100),
  // Long enough for a six-marker written at length, short enough not to be a payload.
  answerText: z.string().max(5000).optional(),
  answerKey: z.string().max(50).optional(),
  setId: z.string().min(1).max(100).optional(),
  context: z
    .enum(["LESSON_CHECK", "PRACTICE", "MINI_MOCK", "FULL_MOCK", "MASTERY_CHECK"])
    .default("PRACTICE"),
  durationSec: z
    .number()
    .int()
    .min(0)
    .max(24 * 3600)
    .optional(),
});

export async function POST(request: Request): Promise<NextResponse> {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in to get your answer marked." }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: "That request doesn't look right." }, { status: 400 });
  }

  /*
   * Rate limited per student in front of the quota, not instead of it. The quota
   * controls spend over a day; this stops a loop burning it in ten seconds.
   */
  const limit = await rateLimit("aiMark", user.id);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "That's a lot of marking at once — give it a moment." },
      { status: 429, headers: { "retry-after": String(limit.retryAfterSeconds) } },
    );
  }

  const outcome = await markAnswer({
    userId: user.id,
    questionId: parsed.data.questionId,
    answerText: parsed.data.answerText ?? null,
    answerKey: parsed.data.answerKey ?? null,
    context: parsed.data.context,
    setId: parsed.data.setId ?? null,
    durationSec: parsed.data.durationSec,
  });

  if (!outcome.ok) {
    return NextResponse.json({ error: outcome.error }, { status: 400 });
  }

  return NextResponse.json({ attemptId: outcome.attemptId, result: outcome.result });
}
