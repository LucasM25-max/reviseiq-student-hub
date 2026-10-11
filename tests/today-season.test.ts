import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { prisma } from "@/lib/db/prisma";
import {
  endSeasonIfPast,
  markCongratulationsSeen,
  owedCongratulations,
} from "@/lib/today/prompts";

/**
 * The end of the exam season, against a real database (D27).
 *
 * This needs rows: the whole behaviour is about a stored flag, a watermark and a
 * plan that has to be retired at the right moment. The bug this suite exists for —
 * the resit hatch being undone a second later by the same check that fired it —
 * was invisible to every pure test, because the interesting state is all in the
 * database.
 */

const USER_ID = "test-season-user";
const DAY_MS = 24 * 60 * 60 * 1000;

const daysFromNow = (n: number) => new Date(Date.now() + n * DAY_MS);

async function reset(options: { examDaysFromNow: number | null }) {
  await prisma.user.deleteMany({ where: { id: USER_ID } });
  await prisma.user.create({
    data: {
      id: USER_ID,
      email: `${USER_ID}@example.test`,
      name: "Season",
      profile: { create: { onboardingCompletedAt: new Date(), schedulingEnabled: true } },
    },
  });

  const enrolment = await prisma.subjectEnrolment.create({
    data: { userId: USER_ID, subjectId: "aqa-biology", active: true },
    select: { id: true },
  });

  if (options.examDaysFromNow !== null) {
    await prisma.examDate.create({
      data: {
        enrolmentId: enrolment.id,
        paper: 1,
        date: daysFromNow(options.examDaysFromNow),
        confirmed: true,
      },
    });
  }
}

const profile = async () =>
  prisma.studentProfile.findUniqueOrThrow({
    where: { userId: USER_ID },
    select: { schedulingEnabled: true, examsCompletedAt: true, congratulationsSeenAt: true },
  });

afterAll(async () => {
  await prisma.user.deleteMany({ where: { id: USER_ID } });
});

describe("ending the season", () => {
  beforeEach(async () => {
    await reset({ examDaysFromNow: -5 });
  });

  it("stops scheduling once the last exam has passed", async () => {
    expect(await endSeasonIfPast(USER_ID, new Date())).toBe(true);

    const after = await profile();
    expect(after.schedulingEnabled).toBe(false);
    expect(after.examsCompletedAt).not.toBeNull();
  });

  it("retires a plan that was built while the season was still running", async () => {
    const planDate = new Date();
    planDate.setUTCHours(0, 0, 0, 0);

    await prisma.dayPlan.create({
      data: {
        userId: USER_ID,
        planDate,
        mode: "BALANCED",
        targetMinutes: 60,
        algoVersion: "test",
      },
    });

    await endSeasonIfPast(USER_ID, new Date());

    // Otherwise the student finishes their last exam and is still handed a list.
    const live = await prisma.dayPlan.count({
      where: { userId: USER_ID, supersededAt: null },
    });
    expect(live).toBe(0);
  });

  it("does nothing while an exam is still to come", async () => {
    await reset({ examDaysFromNow: 10 });
    expect(await endSeasonIfPast(USER_ID, new Date())).toBe(false);
    expect((await profile()).schedulingEnabled).toBe(true);
  });

  it("treats no exam dates as unconfigured, not finished", async () => {
    await reset({ examDaysFromNow: null });
    expect(await endSeasonIfPast(USER_ID, new Date())).toBe(false);
    expect((await profile()).schedulingEnabled).toBe(true);
  });

  it("is idempotent", async () => {
    expect(await endSeasonIfPast(USER_ID, new Date())).toBe(true);
    expect(await endSeasonIfPast(USER_ID, new Date())).toBe(false);
  });
});

describe("the resit hatch", () => {
  beforeEach(async () => {
    await reset({ examDaysFromNow: -5 });
    await endSeasonIfPast(USER_ID, new Date());
  });

  /**
   * The bug this whole file is for. Resuming flips the flag back on, and the very
   * next page load calls `endSeasonIfPast` again — against exam dates that are all
   * still in the past, because the student has not added the resit yet.
   */
  it("survives the next run of the season check", async () => {
    await prisma.studentProfile.update({
      where: { userId: USER_ID },
      data: { schedulingEnabled: true },
    });

    expect(await endSeasonIfPast(USER_ID, new Date())).toBe(false);
    expect((await profile()).schedulingEnabled).toBe(true);
  });

  it("still ends again once the resit itself has passed", async () => {
    const completedAt = (await profile()).examsCompletedAt!;

    await prisma.studentProfile.update({
      where: { userId: USER_ID },
      data: { schedulingEnabled: true },
    });

    const enrolment = await prisma.subjectEnrolment.findFirstOrThrow({
      where: { userId: USER_ID },
      select: { id: true },
    });

    // A November resit, sat and gone.
    await prisma.examDate.create({
      data: {
        enrolmentId: enrolment.id,
        paper: 2,
        date: new Date(completedAt.getTime() + 30 * DAY_MS),
        confirmed: true,
      },
    });

    const later = new Date(completedAt.getTime() + 45 * DAY_MS);
    expect(await endSeasonIfPast(USER_ID, later)).toBe(true);
    expect((await profile()).schedulingEnabled).toBe(false);
  });
});

describe("the congratulations screen", () => {
  beforeEach(async () => {
    await reset({ examDaysFromNow: -5 });
  });

  it("is owed once the season ends, and only once", async () => {
    expect(await owedCongratulations(USER_ID)).toBe(false);

    await endSeasonIfPast(USER_ID, new Date());
    expect(await owedCongratulations(USER_ID)).toBe(true);

    await markCongratulationsSeen(USER_ID);
    expect(await owedCongratulations(USER_ID)).toBe(false);
  });

  it("does not re-stamp a date that is already set", async () => {
    await endSeasonIfPast(USER_ID, new Date());
    await markCongratulationsSeen(USER_ID);

    const first = (await profile()).congratulationsSeenAt;
    await markCongratulationsSeen(USER_ID);
    expect((await profile()).congratulationsSeenAt).toEqual(first);
  });
});
