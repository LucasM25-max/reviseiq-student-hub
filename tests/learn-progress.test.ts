import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { prisma } from "@/lib/db/prisma";
import {
  advanceProgress,
  getLessonState,
  getProgressForLessons,
  getResumableLessons,
  recordCheckAnswer,
} from "@/lib/learn/progress";
import {
  createMasteryRun,
  getLatestCompletedRun,
  getMasteryCandidates,
  getOpenRun,
  getQuestionsByIds,
  getRun,
  MASTERY_REASON,
  recordMasteryAnswers,
  recordSelfMarks,
} from "@/lib/learn/mastery-queries";
import { getLesson } from "@/lib/content/queries";
import { lessonSpecPoints, selectMasteryQuestions } from "@/lib/learn/mastery";

/**
 * The learn runner against a real database.
 *
 * The pure layers are tested elsewhere; what is left is everything that only breaks once
 * two writes race, a student double-clicks, or a page is refreshed on a POST. Those are
 * the bugs that lose someone's place in a lesson, so they are worth real rows.
 *
 * These tests write for real — the functions under test use the request-scoped client,
 * not an injectable one — and clean up by deleting the user, which cascades.
 */

const suffix = Math.random().toString(36).slice(2, 10);
let userId = "";
let lessonId = "";
let otherLessonId = "";

beforeAll(async () => {
  const user = await prisma.user.create({
    data: { email: `learn-progress-${suffix}@example.test`, name: "Progress Test" },
    select: { id: true },
  });
  userId = user.id;

  const lessons = await prisma.lesson.findMany({
    orderBy: { id: "asc" },
    select: { id: true },
    take: 2,
  });
  expect(lessons.length, "seed the content before running this suite").toBe(2);
  lessonId = lessons[0].id;
  otherLessonId = lessons[1].id;
});

afterAll(async () => {
  if (userId) await prisma.user.delete({ where: { id: userId } }).catch(() => undefined);
});

describe("getLessonState", () => {
  it("describes an untouched lesson without writing a row", async () => {
    const before = await prisma.lessonProgress.count({ where: { userId } });
    const state = await getLessonState(userId, lessonId);

    expect(state).toMatchObject({
      lastBlockIndex: 0,
      state: "NOT_STARTED",
      completed: false,
      totalSeconds: 0,
    });
    expect(state.checks.size).toBe(0);

    // A GET must never create progress, or every lesson anyone glances at shows up as
    // started — and "resume where you left off" fills with lessons nobody opened.
    expect(await prisma.lessonProgress.count({ where: { userId } })).toBe(before);
  });
});

describe("advanceProgress", () => {
  it("creates progress on the first advance", async () => {
    const row = await advanceProgress(userId, lessonId, 4, 30);
    expect(row).toMatchObject({ lastBlockIndex: 4, state: "IN_PROGRESS", totalSeconds: 30 });
    expect(row.completedAt).toBeNull();
  });

  it("accumulates time across steps", async () => {
    await advanceProgress(userId, lessonId, 8, 45);
    const state = await getLessonState(userId, lessonId);
    expect(state.totalSeconds).toBe(75);
    expect(state.lastBlockIndex).toBe(8);
  });

  it("does not rewind when an older step is replayed", async () => {
    // The exact shape of a browser back button followed by a re-submit.
    const row = await advanceProgress(userId, lessonId, 2, 5);
    expect(row.lastBlockIndex).toBe(8);
    // The time is still real time the student spent, so it is still counted.
    expect(row.totalSeconds).toBe(80);
  });

  it("marks a lesson complete and keeps the first completion time", async () => {
    const first = await advanceProgress(userId, lessonId, 16, 20, { complete: true });
    expect(first.state).toBe("COMPLETED");
    expect(first.completedAt).not.toBeNull();

    await new Promise((resolve) => setTimeout(resolve, 20));
    const again = await advanceProgress(userId, lessonId, 16, 10, { complete: true });
    expect(again.completedAt?.getTime()).toBe(first.completedAt?.getTime());
  });

  it("does not un-complete a lesson someone re-reads", async () => {
    // Reopening a finished lesson and stepping through it must not reset it to
    // in-progress — that would put it back in the "resume" list and in Today's plan.
    const row = await advanceProgress(userId, lessonId, 4, 15);
    expect(row.state).toBe("COMPLETED");
    expect(row.completedAt).not.toBeNull();
  });

  it("survives two concurrent advances of the same lesson", async () => {
    const fresh = await prisma.user.create({
      data: { email: `race-${suffix}@example.test` },
      select: { id: true },
    });
    try {
      const results = await Promise.allSettled([
        advanceProgress(fresh.id, lessonId, 3, 10),
        advanceProgress(fresh.id, lessonId, 5, 10),
      ]);

      // Whatever the interleaving, there is exactly one row and the student is not behind
      // where they got to.
      const rows = await prisma.lessonProgress.findMany({ where: { userId: fresh.id } });
      const settled = results.filter((result) => result.status === "fulfilled");
      expect(settled.length, "at least one advance must land").toBeGreaterThanOrEqual(1);
      expect(rows).toHaveLength(1);
      expect(rows[0].lastBlockIndex).toBeGreaterThanOrEqual(3);
    } finally {
      await prisma.user.delete({ where: { id: fresh.id } });
    }
  });
});

describe("recordCheckAnswer", () => {
  it("records a first answer", async () => {
    const row = await recordCheckAnswer(userId, lessonId, 8, "C", false);
    expect(row).toMatchObject({
      chosenKey: "C",
      correct: false,
      firstCorrect: false,
      attempts: 1,
    });
  });

  it("keeps firstCorrect at what the student knew before seeing the answer", async () => {
    // Getting it right on the retry is recall of the explanation they just read, not
    // evidence of prior knowledge, so the first verdict is the one that must survive.
    const row = await recordCheckAnswer(userId, lessonId, 8, "A", true);
    expect(row).toMatchObject({
      chosenKey: "A",
      correct: true,
      firstCorrect: false,
      attempts: 2,
    });
  });

  it("does not retro-fit firstCorrect downwards either", async () => {
    await recordCheckAnswer(userId, lessonId, 12, "A", true);
    const row = await recordCheckAnswer(userId, lessonId, 12, "D", false);
    expect(row.firstCorrect).toBe(true);
    expect(row.correct).toBe(false);
  });

  it("surfaces every check through getLessonState, keyed by block index", async () => {
    const state = await getLessonState(userId, lessonId);
    expect(state.checks.get(8)).toMatchObject({
      chosenKey: "A",
      correct: true,
      firstCorrect: false,
    });
    expect(state.checks.get(12)).toMatchObject({ chosenKey: "D", firstCorrect: true });
    expect(state.checks.get(99)).toBeUndefined();
  });

  it("keeps two lessons' checks apart", async () => {
    await recordCheckAnswer(userId, otherLessonId, 8, "B", true);
    const here = await getLessonState(userId, lessonId);
    const there = await getLessonState(userId, otherLessonId);
    expect(here.checks.get(8)?.chosenKey).toBe("A");
    expect(there.checks.get(8)?.chosenKey).toBe("B");
  });
});

describe("getProgressForLessons and getResumableLessons", () => {
  it("returns a row per started lesson and nothing for the rest", async () => {
    const map = await getProgressForLessons(userId, [
      lessonId,
      otherLessonId,
      "does-not-exist",
    ]);
    expect(map.get(lessonId)?.state).toBe("COMPLETED");
    expect(map.get("does-not-exist")).toBeUndefined();
  });

  it("lists in-progress lessons only, newest first", async () => {
    await advanceProgress(userId, otherLessonId, 2, 10);
    const resumable = await getResumableLessons(userId);

    expect(resumable.map((row) => row.lessonId)).toEqual([otherLessonId]);
    expect(resumable[0].lesson.slug).toBeTruthy();
    expect(resumable[0].lesson.subTopic.code).toBeTruthy();
  });

  it("respects the limit", async () => {
    expect(await getResumableLessons(userId, 0)).toHaveLength(0);
  });
});

describe("a mastery run, end to end", () => {
  let setId = "";
  let subTopicId = "";
  let specPoints: string[] = [];

  beforeAll(async () => {
    const lesson = await prisma.lesson.findUniqueOrThrow({
      where: { id: lessonId },
      select: { subTopicId: true, slug: true },
    });
    subTopicId = lesson.subTopicId;

    const content = await getLesson(lesson.subTopicId, lesson.slug);
    expect(content, "the lesson must exist in the content registry").not.toBeNull();
    specPoints = lessonSpecPoints(content!.blocks);
    expect(specPoints.length).toBeGreaterThan(0);
  });

  it("loads questions in the order it asked for them", async () => {
    const candidates = await getMasteryCandidates(subTopicId, specPoints);
    const ids = candidates
      .map((candidate) => candidate.id)
      .sort()
      .slice(0, 3);
    const reversed = [...ids].reverse();

    const loaded = await getQuestionsByIds(reversed);
    expect(loaded.map((question) => question.id)).toEqual(reversed);
    expect(loaded[0].stem).toBeTruthy();
    expect(loaded[0].marks).toBeGreaterThan(0);
  });

  it("finds candidates for the lesson's spec points, and none for a subject with none", async () => {
    expect((await getMasteryCandidates(subTopicId, specPoints)).length).toBeGreaterThan(0);
    expect(await getMasteryCandidates(subTopicId, [])).toEqual([]);
    expect(await getMasteryCandidates(subTopicId, ["not-a-spec-point"])).toEqual([]);
  });

  it("starts a run from the deterministic selection", async () => {
    const run = await createMasteryRun(userId, lessonId, subTopicId, specPoints);
    expect(run).not.toBeNull();
    setId = run!.id;

    expect(run).toMatchObject({ reason: MASTERY_REASON, lessonId, userId });
    expect(run!.questionIds.length).toBeGreaterThanOrEqual(3);
    expect(run!.answeredAt).toBeNull();
    expect(run!.completedAt).toBeNull();
  });

  it("picks the same questions the pure selector would", async () => {
    const candidates = await getMasteryCandidates(subTopicId, specPoints);
    const expected = selectMasteryQuestions(specPoints, candidates).questionIds;
    const run = await getRun(userId, setId);
    expect(run!.questionIds).toEqual(expected);
  });

  it("finds the open run, so a refresh resumes instead of starting again", async () => {
    const open = await getOpenRun(userId, lessonId);
    expect(open?.id).toBe(setId);
  });

  it("records answers and stamps answeredAt", async () => {
    const run = await getRun(userId, setId);
    const questions = await getQuestionsByIds(run!.questionIds);

    await recordMasteryAnswers(
      userId,
      run!,
      questions,
      questions.map((question) => ({
        questionId: question.id,
        answerKey: question.correctKey ?? null,
        answerText: question.correctKey ? null : "A written answer.",
      })),
      12,
    );

    const answered = await getRun(userId, setId);
    expect(answered?.answeredAt).not.toBeNull();
    expect(answered?.attempts).toHaveLength(run!.questionIds.length);
  });

  it("auto-marks the objective questions and leaves the written ones for self-marking", async () => {
    const run = await getRun(userId, setId);
    let autoMarked = 0;

    for (const attempt of run!.attempts) {
      expect(attempt.context).toBe("MASTERY_CHECK");
      expect(attempt.setId).toBe(setId);
      expect(attempt.userId).toBe(userId);

      if (attempt.answerKey) {
        autoMarked += 1;
        expect(attempt.markedBy).toBe("AUTO");
        // Every key submitted was the correct one, so every auto mark is full marks.
        expect(attempt.awardedMarks).toBe(attempt.maxMarks);
      } else {
        expect(attempt.markedBy).toBe("SELF");
        expect(attempt.awardedMarks).toBe(0);
      }
    }

    expect(autoMarked, "the first lesson has one auto-markable question").toBe(1);
  });

  it("leaves the run open while anything still needs self-marking", async () => {
    const run = await getRun(userId, setId);
    expect(run?.completedAt).toBeNull();
  });

  it("is idempotent — resubmitting updates the rows instead of adding more", async () => {
    const run = await getRun(userId, setId);
    const questions = await getQuestionsByIds(run!.questionIds);

    await recordMasteryAnswers(
      userId,
      run!,
      questions,
      questions.map((question) => ({
        questionId: question.id,
        answerKey: question.correctKey ? "A" : null,
        answerText: question.correctKey ? null : "Changed my mind.",
      })),
      3,
    );

    expect(await prisma.questionAttempt.count({ where: { setId } })).toBe(
      run!.questionIds.length,
    );

    // And the new answers really did replace the old ones.
    const updated = await getRun(userId, setId);
    const written = updated!.attempts.filter((attempt) => attempt.answerText !== null);
    expect(written.every((attempt) => attempt.answerText === "Changed my mind.")).toBe(true);
  });

  it("re-marks an objective answer that changed from right to wrong", async () => {
    const run = await getRun(userId, setId);
    const objective = run!.attempts.filter((attempt) => attempt.markedBy === "AUTO");
    expect(objective.length).toBe(1);
    // The resubmission above answered every MCQ "A". Whether that is right or wrong,
    // the recorded mark must match the answer now on file, not the earlier one.
    const questions = await getQuestionsByIds([objective[0].questionId]);
    const expected = questions[0].correctKey === "A" ? questions[0].marks : 0;
    expect(objective[0].awardedMarks).toBe(expected);
  });

  it("clamps a self-mark to what the question is worth", async () => {
    const run = await getRun(userId, setId);
    const selfMarked = run!.attempts.filter((attempt) => attempt.markedBy === "SELF");
    expect(selfMarked.length).toBeGreaterThan(0);

    await recordSelfMarks(
      userId,
      setId,
      selfMarked.map((attempt) => ({ questionId: attempt.questionId, awardedMarks: 99 })),
    );

    const marked = await getRun(userId, setId);
    expect(marked?.completedAt).not.toBeNull();
    for (const attempt of marked!.attempts) {
      expect(attempt.awardedMarks).toBeLessThanOrEqual(attempt.maxMarks);
      expect(attempt.awardedMarks).toBeGreaterThanOrEqual(0);
    }
  });

  it("will not let a self-mark overwrite an auto-marked answer", async () => {
    const before = await getRun(userId, setId);
    const auto = before!.attempts.find((attempt) => attempt.markedBy === "AUTO")!;

    await recordSelfMarks(userId, setId, [
      { questionId: auto.questionId, awardedMarks: auto.maxMarks },
    ]);

    const after = await getRun(userId, setId);
    const same = after!.attempts.find((attempt) => attempt.id === auto.id)!;
    expect(same.awardedMarks).toBe(auto.awardedMarks);
    expect(same.markedBy).toBe("AUTO");
  });

  it("ignores a mark aimed at a question outside the run", async () => {
    const before = await getRun(userId, setId);
    await recordSelfMarks(userId, setId, [{ questionId: "not-in-this-run", awardedMarks: 3 }]);
    const after = await getRun(userId, setId);

    expect(after!.attempts.map((attempt) => attempt.awardedMarks).sort()).toEqual(
      before!.attempts.map((attempt) => attempt.awardedMarks).sort(),
    );
  });

  it("stops being the open run once finished, and becomes the latest result", async () => {
    expect(await getOpenRun(userId, lessonId)).toBeNull();
    expect((await getLatestCompletedRun(userId, lessonId))?.id).toBe(setId);
  });

  it("lets the student retake without destroying the previous attempt", async () => {
    const retake = await createMasteryRun(userId, lessonId, subTopicId, specPoints);
    expect(retake).not.toBeNull();
    expect(retake!.id).not.toBe(setId);
    expect((await getOpenRun(userId, lessonId))?.id).toBe(retake!.id);

    // The finished run is still there to look back at.
    expect(await getRun(userId, setId)).not.toBeNull();
    expect((await getLatestCompletedRun(userId, lessonId))?.id).toBe(setId);

    await prisma.questionSet.delete({ where: { id: retake!.id } });
  });

  it("refuses to touch another student's run", async () => {
    const stranger = await prisma.user.create({
      data: { email: `stranger-${suffix}@example.test` },
      select: { id: true },
    });
    try {
      expect(await getRun(stranger.id, setId)).toBeNull();
      expect(await getLatestCompletedRun(stranger.id, lessonId)).toBeNull();

      const before = await getRun(userId, setId);
      // The query layer must refuse this on its own, without relying on the action
      // above it having checked first.
      expect(
        await recordSelfMarks(stranger.id, setId, [
          { questionId: before!.attempts[0].questionId, awardedMarks: 0 },
        ]),
      ).toBeNull();

      const after = await getRun(userId, setId);
      expect(after!.attempts.map((attempt) => attempt.awardedMarks)).toEqual(
        before!.attempts.map((attempt) => attempt.awardedMarks),
      );
      expect(after!.completedAt?.getTime()).toBe(before!.completedAt?.getTime());
    } finally {
      await prisma.user.delete({ where: { id: stranger.id } });
    }
  });
});
