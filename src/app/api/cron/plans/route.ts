/**
 * Nightly plan generation (doc 05 §8).
 *
 * Runs about 04:00 and builds tomorrow's plan for everyone still scheduling, so the
 * app is ready before the student opens it. On-demand generation still exists and
 * still covers timezone drift and new accounts — this is an optimisation, never the
 * only path, which is what keeps a missed cron run harmless.
 *
 * Also ends the exam season for anyone whose last paper has passed (D27).
 */

import { NextResponse } from "next/server";

import { prisma } from "@/lib/db/prisma";
import { ensurePlanFor } from "@/lib/today/materialise";
import { endSeasonIfPast } from "@/lib/today/prompts";

/** Vercel Cron signs its requests; nothing else may run this. */
function authorised(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();

  // Without a secret configured the endpoint is closed rather than open.
  if (!secret) return false;

  const header = request.headers.get("authorization");
  return header === `Bearer ${secret}`;
}

export async function GET(request: Request): Promise<NextResponse> {
  if (!authorised(request)) {
    return NextResponse.json({ error: "Not authorised." }, { status: 401 });
  }

  const now = new Date();

  const students = await prisma.studentProfile.findMany({
    where: { onboardingCompletedAt: { not: null } },
    select: { userId: true, schedulingEnabled: true },
    // A ceiling, so one run cannot grow unbounded as the user base does.
    take: 2000,
  });

  let planned = 0;
  let ended = 0;
  let skipped = 0;
  let failed = 0;

  for (const student of students) {
    try {
      if (await endSeasonIfPast(student.userId, now)) {
        ended += 1;
        continue;
      }

      if (!student.schedulingEnabled) {
        skipped += 1;
        continue;
      }

      const plan = await ensurePlanFor(student.userId, now, { regenerate: true });
      if (plan) planned += 1;
      else skipped += 1;
    } catch (error) {
      // One student's bad data must never stop the run for everyone else.
      failed += 1;
      console.error(`[cron] plan generation failed for ${student.userId}`, error);
    }
  }

  return NextResponse.json({ planned, ended, skipped, failed, total: students.length });
}
