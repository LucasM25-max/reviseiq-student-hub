import { describe, expect, it } from "vitest";

import { generateCandidates } from "@/lib/today/candidates";
import { buildPlan, durationRatio, targetHref } from "@/lib/today/plan";
import { gateFor } from "@/lib/today/gate";
import { selectMode, targetMinutesFor } from "@/lib/today/mode";
import { CARDS, PACKING, SCHOOL_TEST_SHARE, ALGO_VERSION } from "@/lib/today/weights";
import type {
  ContentSubTopic,
  PlannerInput,
  RagEntry,
  RagValue,
  TierChoice,
} from "@/lib/today/types";

/**
 * The Today engine.
 *
 * The engine is pure, so it gets a real test suite: archetypal students as fixtures,
 * and a set of invariants asserted on every plan any of them produce. The invariants
 * matter more than any single case — they are what stops a scheduler quietly doing
 * something indefensible to a student nobody thought to write a fixture for.
 */

const NOW = new Date("2026-03-02T07:00:00Z"); // a Monday
const inDays = (n: number) => new Date(NOW.getTime() + n * 24 * 60 * 60 * 1000);
const agoDays = (n: number) => new Date(NOW.getTime() - n * 24 * 60 * 60 * 1000);

function subTopic(
  over: Partial<ContentSubTopic> & { id: string; subjectId: string },
): ContentSubTopic {
  return {
    code: "4.1.1",
    title: "Cell biology",
    paper: 1,
    lessons: [{ id: `${over.id}-l1`, slug: "lesson-one", estMinutes: 20, higherOnly: false }],
    noteSections: [{ anchor: "overview", estMinutes: 8, specPointIds: [`${over.id}-sp1`] }],
    blurtPrompts: [{ id: `${over.id}-b1`, estMinutes: 5 }],
    questions: Array.from({ length: 10 }, (_, i) => ({
      id: `${over.id}-q${i}`,
      marks: (i % 4) + 1,
      difficulty: (i % 3) + 1,
      estSeconds: 90,
      higherOnly: i === 9,
      specPointIds: [`${over.id}-sp${(i % 2) + 1}`],
    })),
    practicals: [],
    specPointIds: [`${over.id}-sp1`, `${over.id}-sp2`],
    ...over,
  };
}

function input(over: Partial<PlannerInput> = {}): PlannerInput {
  const subTopics = over.contentIndex?.subTopics ?? [
    subTopic({ id: "bio-1", subjectId: "aqa-biology" }),
    subTopic({ id: "bio-2", subjectId: "aqa-biology", code: "4.1.2" }),
    subTopic({ id: "chem-1", subjectId: "aqa-chemistry", code: "5.1.1", paper: 1 }),
  ];

  return {
    now: NOW,
    targetMinutes: 60,
    profile: {
      dailyGoalMinutes: 60,
      holidayGoalMinutes: 90,
      yearGroup: "YEAR_11",
      timezone: "Europe/London",
      schedulingEnabled: true,
    },
    calendarPeriod: { kind: "TERM", endDate: inDays(40) },
    schoolTests: [],
    enrolments: [
      {
        subjectId: "aqa-biology",
        subjectName: "Biology",
        subjectSlug: "biology",
        tier: "HIGHER" as TierChoice,
        examDates: [{ paper: 1, date: inDays(45), confirmed: true }],
      },
      {
        subjectId: "aqa-chemistry",
        subjectName: "Chemistry",
        subjectSlug: "chemistry",
        tier: "HIGHER" as TierChoice,
        examDates: [{ paper: 1, date: inDays(50), confirmed: true }],
      },
    ],
    rag: [
      { scope: "SUBTOPIC", id: "bio-1", value: "RED" },
      { scope: "SUBTOPIC", id: "bio-2", value: "AMBER" },
      { scope: "SUBTOPIC", id: "chem-1", value: "GREEN" },
    ],
    learningNow: [],
    mastery: [],
    dueCards: { total: 0, overdueDays: [], bySubject: {} },
    completedLessonIds: [],
    recentHistory: [],
    contentIndex: { subTopics },
    accountAgeDays: 60,
    gateShutDays: 0,
    algoVersion: ALGO_VERSION,
    ...over,
  };
}

const ragAll = (value: RagValue): RagEntry[] => [
  { scope: "SUBTOPIC", id: "bio-1", value },
  { scope: "SUBTOPIC", id: "bio-2", value },
  { scope: "SUBTOPIC", id: "chem-1", value },
];

// ---------------------------------------------------------------------------
// The archetypes (doc 05 §11)
// ---------------------------------------------------------------------------

const ARCHETYPES: Array<{ name: string; input: PlannerInput }> = [
  { name: "brand new", input: input({ accountAgeDays: 0, rag: ragAll("NOT_LEARNT") }) },
  { name: "all red", input: input({ rag: ragAll("RED") }) },
  { name: "all green", input: input({ rag: ragAll("GREEN") }) },
  {
    name: "one week to the exam",
    input: input({
      enrolments: input().enrolments.map((e) => ({
        ...e,
        examDates: [{ paper: 1, date: inDays(6), confirmed: true }],
      })),
    }),
  },
  {
    name: "returning after three weeks",
    input: input({
      mastery: [
        { specPointId: "bio-1-sp1", mastery: 0.5, confidence: 1, lastTouchedAt: agoDays(21) },
      ],
      dueCards: { total: 60, overdueDays: [21, 18, 14], bySubject: { "aqa-biology": 60 } },
    }),
  },
  {
    name: "single subject",
    input: input({
      enrolments: [input().enrolments[0]!],
      contentIndex: { subTopics: [subTopic({ id: "bio-1", subjectId: "aqa-biology" })] },
      rag: [{ scope: "SUBTOPIC", id: "bio-1", value: "AMBER" }],
    }),
  },
  { name: "fifteen minutes a day", input: input({ targetMinutes: 15 }) },
  { name: "weekend warrior", input: input({ targetMinutes: 180 }) },
  {
    name: "year 10 mid-term",
    input: input({
      profile: { ...input().profile, yearGroup: "YEAR_10" },
      enrolments: input().enrolments.map((e) => ({
        ...e,
        examDates: [{ paper: 1, date: inDays(400), confirmed: false }],
      })),
    }),
  },
  {
    name: "class test in three days",
    input: input({
      schoolTests: [
        {
          id: "t1",
          subjectId: "aqa-biology",
          date: inDays(3),
          kind: "CLASS_TEST",
          subTopicIds: ["bio-1", "bio-2"],
        },
      ],
    }),
  },
  {
    name: "easter holiday",
    input: input({
      calendarPeriod: { kind: "HOLIDAY", endDate: inDays(10), minutesPerDay: 120 },
      targetMinutes: 120,
    }),
  },
  {
    name: "study leave, exam tomorrow",
    input: input({
      calendarPeriod: { kind: "STUDY_LEAVE", endDate: inDays(20) },
      enrolments: input().enrolments.map((e) => ({
        ...e,
        examDates: [{ paper: 1, date: inDays(1), confirmed: true }],
      })),
    }),
  },
  {
    name: "exam day",
    input: input({
      calendarPeriod: {
        kind: "EXAM_SEASON",
        endDate: inDays(14),
        examToday: { subjectId: "aqa-biology", paper: 1 },
      },
    }),
  },
  {
    name: "post exam",
    input: input({ profile: { ...input().profile, schedulingEnabled: false } }),
  },
  {
    name: "resitter",
    input: input({
      profile: { ...input().profile, schedulingEnabled: true },
      enrolments: input().enrolments.map((e) => ({
        ...e,
        examDates: [{ paper: 1, date: inDays(30), confirmed: true }],
      })),
    }),
  },
  {
    name: "foundation student",
    input: input({
      enrolments: input().enrolments.map((e) => ({ ...e, tier: "FOUNDATION" as TierChoice })),
    }),
  },
];

// ---------------------------------------------------------------------------

describe("plan invariants, on every archetype", () => {
  for (const archetype of ARCHETYPES) {
    describe(archetype.name, () => {
      const plan = buildPlan(archetype.input);
      const suppressed = plan.suppressed !== null;

      it("produces at least one task, unless the day is suppressed", () => {
        if (suppressed) expect(plan.tasks).toHaveLength(0);
        else expect(plan.tasks.length).toBeGreaterThanOrEqual(1);
      });

      it("never lists more than six things", () => {
        // A list of eleven things is a list nobody starts.
        expect(plan.tasks.length).toBeLessThanOrEqual(PACKING.maxTasks);
      });

      it("fits the time available, give or take the allowed overrun", () => {
        expect(plan.totalEstMinutes).toBeLessThanOrEqual(
          archetype.input.targetMinutes * PACKING.overrun,
        );
      });

      it("never gives a Foundation student Higher-only content", () => {
        const foundation = new Set(
          archetype.input.enrolments.filter((e) => e.tier !== "HIGHER").map((e) => e.subjectId),
        );
        for (const task of plan.tasks) {
          if (foundation.has(task.subjectId)) expect(task.higherOnly).toBe(false);
        }
      });

      it("only references content that exists", () => {
        const subTopicIds = new Set(archetype.input.contentIndex.subTopics.map((s) => s.id));
        const questionIds = new Set(
          archetype.input.contentIndex.subTopics.flatMap((s) => s.questions.map((q) => q.id)),
        );

        for (const task of plan.tasks) {
          if (task.subTopicId) expect(subTopicIds.has(task.subTopicId)).toBe(true);
          if ("questionIds" in task.ref) {
            for (const id of task.ref.questionIds) expect(questionIds.has(id)).toBe(true);
          }
        }
      });

      it("gives every task a deep link and a reason", () => {
        for (const task of plan.tasks) {
          const href = targetHref(task, "task-1");
          expect(href.startsWith("/")).toBe(true);
          expect(href).toContain("task=task-1");
          // Never a hub page.
          expect(href).not.toMatch(/^\/(learn|revise|test)\?/);
          expect(task.rationale.length).toBeGreaterThan(8);
        }
      });

      it("never places a full mock in a short session", () => {
        if (archetype.input.targetMinutes < PACKING.fullMockMinMinutes) {
          expect(plan.tasks.some((task) => task.type === "FULL_MOCK")).toBe(false);
        }
      });

      it("keeps flashcards within their share of the session", () => {
        const cards = plan.tasks.find((task) => task.type === "FLASHCARDS");
        if (!cards) return;
        expect(cards.estMinutes).toBeLessThanOrEqual(
          archetype.input.targetMinutes * CARDS.maxShare + 1,
        );
        if (cards.ref.kind === "FLASHCARDS") {
          expect(cards.ref.cardCount).toBeLessThanOrEqual(CARDS.dailyCap);
        }
      });

      it("is deterministic", () => {
        expect(buildPlan(archetype.input)).toEqual(plan);
      });
    });
  }
});

// ---------------------------------------------------------------------------

describe("scheduling is off after the last exam (D27)", () => {
  it("refuses to generate anything at all", () => {
    const plan = buildPlan(
      input({ profile: { ...input().profile, schedulingEnabled: false } }),
    );
    expect(plan.tasks).toEqual([]);
    expect(plan.suppressed?.reason).toBe("SCHEDULING_OFF");
  });

  it("resumes for a resitter once the flag is flipped back", () => {
    const plan = buildPlan(input({ profile: { ...input().profile, schedulingEnabled: true } }));
    expect(plan.tasks.length).toBeGreaterThan(0);
    expect(plan.suppressed).toBeNull();
  });
});

describe("exam day", () => {
  it("is left alone, with a word of luck rather than a plan", () => {
    const plan = buildPlan(
      input({
        calendarPeriod: {
          kind: "EXAM_SEASON",
          endDate: inDays(10),
          examToday: { subjectId: "aqa-biology", paper: 1 },
        },
      }),
    );
    expect(plan.tasks).toEqual([]);
    expect(plan.suppressed?.reason).toBe("EXAM_TODAY");
    expect(plan.suppressed?.message).toContain("Good luck");
  });
});

// ---------------------------------------------------------------------------

describe("the NOT_LEARNT gate", () => {
  it("is open for a student with nothing learnt yet", () => {
    expect(gateFor([{ scope: "SUBTOPIC", id: "a", value: "NOT_LEARNT" }]).open).toBe(true);
  });

  it("is open when everything learnt is green", () => {
    expect(
      gateFor([
        { scope: "SUBTOPIC", id: "a", value: "GREEN" },
        { scope: "SUBTOPIC", id: "b", value: "NOT_LEARNT" },
      ]).open,
    ).toBe(true);
  });

  it("is shut while anything learnt is red or amber", () => {
    const gate = gateFor([
      { scope: "SUBTOPIC", id: "a", value: "RED" },
      { scope: "SUBTOPIC", id: "b", value: "AMBER" },
      { scope: "SUBTOPIC", id: "c", value: "NOT_LEARNT" },
    ]);
    expect(gate.open).toBe(false);
    expect(gate.blockingCount).toBe(2);
  });

  it("lets one lesson through after a fortnight of no movement", () => {
    const rag: RagEntry[] = [{ scope: "SUBTOPIC", id: "a", value: "RED" }];
    expect(gateFor(rag, 13).open).toBe(false);
    expect(gateFor(rag, 14).reason).toBe("stale-relief");
  });

  it("suppresses NOT_LEARNT lessons in the plan when shut, and says so", () => {
    const plan = buildPlan(
      input({
        rag: [
          { scope: "SUBTOPIC", id: "bio-1", value: "RED" },
          { scope: "SUBTOPIC", id: "bio-2", value: "NOT_LEARNT" },
          { scope: "SUBTOPIC", id: "chem-1", value: "GREEN" },
        ],
      }),
    );

    const newLesson = plan.tasks.find(
      (task) => task.type === "LESSON" && task.subTopicId === "bio-2",
    );
    expect(newLesson).toBeUndefined();
    // Never a silent absence.
    expect(plan.gateMessage).toContain("Biology");
    expect(plan.gateMessage).toContain("Learn");
  });

  it("opens for a sub-topic school is teaching right now", () => {
    const gated = input({
      rag: [
        { scope: "SUBTOPIC", id: "bio-1", value: "RED" },
        { scope: "SUBTOPIC", id: "bio-2", value: "NOT_LEARNT" },
        { scope: "SUBTOPIC", id: "chem-1", value: "GREEN" },
      ],
      targetMinutes: 120,
    });

    const lessons = (i: PlannerInput) =>
      generateCandidates(i, selectMode(i)).candidates.filter(
        (c) => c.type === "LESSON" && c.subTopicId === "bio-2",
      );

    expect(lessons(gated)).toHaveLength(0);
    expect(
      lessons({ ...gated, learningNow: [{ subTopicId: "bio-2", expiresAt: inDays(20) }] }),
    ).toHaveLength(1);
  });

  it("ignores a LearningNowFlag that has expired", () => {
    const i = input({
      rag: [
        { scope: "SUBTOPIC", id: "bio-1", value: "RED" },
        { scope: "SUBTOPIC", id: "bio-2", value: "NOT_LEARNT" },
        { scope: "SUBTOPIC", id: "chem-1", value: "GREEN" },
      ],
      learningNow: [{ subTopicId: "bio-2", expiresAt: agoDays(1) }],
      targetMinutes: 120,
    });

    expect(
      generateCandidates(i, selectMode(i)).candidates.filter(
        (c) => c.type === "LESSON" && c.subTopicId === "bio-2",
      ),
    ).toHaveLength(0);
  });

  it("is per subject, so one weak subject does not freeze the other", () => {
    const i = input({
      rag: [
        { scope: "SUBTOPIC", id: "bio-1", value: "GREEN" },
        { scope: "SUBTOPIC", id: "bio-2", value: "NOT_LEARNT" },
        { scope: "SUBTOPIC", id: "chem-1", value: "RED" },
      ],
      targetMinutes: 120,
    });

    // Biology is clean, so its new lesson is allowed even though Chemistry is red.
    expect(
      generateCandidates(i, selectMode(i)).candidates.filter(
        (c) => c.type === "LESSON" && c.subTopicId === "bio-2",
      ),
    ).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------

describe("plan mode", () => {
  const modeFor = (over: Partial<PlannerInput>) => selectMode(input(over));

  it("keeps Year 10 on pace rather than counting down to a GCSE", () => {
    expect(
      modeFor({
        profile: { ...input().profile, yearGroup: "YEAR_10" },
        enrolments: input().enrolments.map((e) => ({
          ...e,
          examDates: [{ paper: 1, date: inDays(400), confirmed: false }],
        })),
      }),
    ).toBe("KEEPING_PACE");
  });

  it("still sprints a Year 10 into their own summer exams", () => {
    expect(
      modeFor({
        profile: { ...input().profile, yearGroup: "YEAR_10" },
        enrolments: input().enrolments.map((e) => ({
          ...e,
          examDates: [{ paper: 1, date: inDays(5), confirmed: true }],
        })),
      }),
    ).toBe("FINAL_SPRINT");
  });

  it("walks a Year 11 down the countdown", () => {
    const at = (days: number) =>
      modeFor({
        enrolments: input().enrolments.map((e) => ({
          ...e,
          examDates: [{ paper: 1, date: inDays(days), confirmed: true }],
        })),
      });

    expect(at(5)).toBe("FINAL_SPRINT");
    expect(at(20)).toBe("EXAM_FOCUS");
    expect(at(40)).toBe("BALANCED");
    expect(at(90)).toBe("LEARNING_HEAVY");
  });

  it("lets study leave override the countdown entirely", () => {
    expect(modeFor({ calendarPeriod: { kind: "STUDY_LEAVE", endDate: inDays(20) } })).toBe(
      "STUDY_LEAVE",
    );
  });

  it("falls back sensibly when no exam dates are set", () => {
    expect(
      modeFor({ enrolments: input().enrolments.map((e) => ({ ...e, examDates: [] })) }),
    ).toBe("BALANCED");
  });

  it("suppresses new lessons in the final fortnight", () => {
    const plan = buildPlan(
      input({
        rag: ragAll("RED"),
        enrolments: input().enrolments.map((e) => ({
          ...e,
          examDates: [{ paper: 1, date: inDays(5), confirmed: true }],
        })),
        targetMinutes: 120,
      }),
    );
    expect(plan.mode).toBe("FINAL_SPRINT");
    expect(plan.tasks.some((task) => task.type === "LESSON")).toBe(false);
  });
});

describe("target minutes", () => {
  it("uses the holiday figure on a holiday", () => {
    expect(
      targetMinutesFor({
        profile: input().profile,
        calendarPeriod: { kind: "HOLIDAY", endDate: inDays(5) },
      }),
    ).toBe(90);
  });

  it("lets an explicit quick session win (D10)", () => {
    expect(
      targetMinutesFor({
        profile: input().profile,
        calendarPeriod: { kind: "TERM", endDate: inDays(5) },
        override: 15,
      }),
    ).toBe(15);
  });

  it("refuses a silly override rather than planning a ten-hour day", () => {
    expect(
      targetMinutesFor({
        profile: input().profile,
        calendarPeriod: { kind: "TERM", endDate: inDays(5) },
        override: 99999,
      }),
    ).toBe(600);
  });
});

// ---------------------------------------------------------------------------

describe("school tests (D25)", () => {
  const withTest = (days: number, kind: "CLASS_TEST" | "SCHOOL_MOCK" = "CLASS_TEST") =>
    input({
      targetMinutes: 60,
      schoolTests: [
        {
          id: "t1",
          subjectId: "aqa-biology",
          date: inDays(days),
          kind,
          subTopicIds: ["bio-1", "bio-2"],
        },
      ],
    });

  it("pulls the covered sub-topics up as the test approaches", () => {
    const urgencyOf = (days: number) => {
      const i = withTest(days);
      const covered = generateCandidates(i, selectMode(i)).candidates.filter(
        (c) => c.subTopicId === "bio-1",
      );
      return Math.max(...covered.map((c) => c.terms.schoolTest ?? 0));
    };

    // Barely felt at a fortnight, dominant at two days.
    expect(urgencyOf(13)).toBeLessThan(0.15);
    expect(urgencyOf(2)).toBeGreaterThan(0.4);
    expect(urgencyOf(2)).toBeGreaterThan(urgencyOf(7));
  });

  it("never lets one class test eat the whole session", () => {
    const plan = buildPlan(withTest(2));
    const testMinutes = plan.tasks
      .filter((task) => task.fromSchoolTest)
      .reduce((sum, task) => sum + task.estMinutes, 0);

    expect(testMinutes).toBeLessThanOrEqual(
      plan.targetMinutes * SCHOOL_TEST_SHARE.nearShare + 1,
    );
  });

  it("says why, by name and by day", () => {
    const plan = buildPlan(withTest(2));
    const task = plan.tasks.find((entry) => entry.fromSchoolTest);
    expect(task?.rationale).toMatch(/Biology test/);
  });

  it("opens the gate for content the test covers", () => {
    const i = input({
      rag: [
        { scope: "SUBTOPIC", id: "bio-1", value: "RED" },
        { scope: "SUBTOPIC", id: "bio-2", value: "NOT_LEARNT" },
        { scope: "SUBTOPIC", id: "chem-1", value: "GREEN" },
      ],
      targetMinutes: 120,
      schoolTests: [
        {
          id: "t1",
          subjectId: "aqa-biology",
          date: inDays(4),
          kind: "END_OF_TOPIC",
          subTopicIds: ["bio-2"],
        },
      ],
    });

    // Blocking a lesson on something tested in four days would be indefensible.
    expect(
      generateCandidates(i, selectMode(i)).candidates.filter(
        (c) => c.type === "LESSON" && c.subTopicId === "bio-2",
      ),
    ).toHaveLength(1);
  });

  it("ignores a test more than a fortnight away", () => {
    const plan = buildPlan(withTest(20));
    expect(plan.tasks.every((task) => !task.fromSchoolTest)).toBe(true);
  });
});

// ---------------------------------------------------------------------------

describe("flashcards lead the session", () => {
  it("go first when cards are due", () => {
    const plan = buildPlan(
      input({ dueCards: { total: 24, overdueDays: [5, 2], bySubject: { "aqa-biology": 24 } } }),
    );
    expect(plan.tasks[0]?.type).toBe("FLASHCARDS");
  });

  it("are capped by the session, not just by the deck", () => {
    const plan = buildPlan(
      input({
        targetMinutes: 20,
        dueCards: { total: 500, overdueDays: [30], bySubject: { "aqa-biology": 500 } },
      }),
    );
    const cards = plan.tasks.find((task) => task.type === "FLASHCARDS");
    expect(cards?.ref.kind === "FLASHCARDS" && cards.ref.cardCount).toBeLessThanOrEqual(
      CARDS.dailyCap,
    );
    expect(cards!.estMinutes).toBeLessThanOrEqual(20 * CARDS.maxShare + 1);
  });

  it("are absent when nothing is due, rather than padded", () => {
    const plan = buildPlan(input({ dueCards: { total: 0, overdueDays: [], bySubject: {} } }));
    expect(plan.tasks.some((task) => task.type === "FLASHCARDS")).toBe(false);
  });

  it("explain themselves with the count", () => {
    const plan = buildPlan(
      input({ dueCards: { total: 12, overdueDays: [1], bySubject: { "aqa-biology": 12 } } }),
    );
    expect(plan.tasks[0]?.rationale).toContain("12 cards");
  });
});

// ---------------------------------------------------------------------------

describe("packing", () => {
  it("brings in a second subject once the session is long enough", () => {
    const plan = buildPlan(input({ targetMinutes: 90 }));
    expect(new Set(plan.tasks.map((task) => task.subjectId)).size).toBeGreaterThanOrEqual(2);
  });

  it("does not force a second subject into a fifteen-minute session", () => {
    const plan = buildPlan(input({ targetMinutes: 15 }));
    expect(plan.tasks.length).toBeGreaterThanOrEqual(1);
    expect(plan.totalEstMinutes).toBeLessThanOrEqual(15 * PACKING.overrun);
  });

  it("never runs three of the same task type together", () => {
    const plan = buildPlan(input({ targetMinutes: 180 }));
    for (let i = 2; i < plan.tasks.length; i += 1) {
      const three = [plan.tasks[i - 2]!, plan.tasks[i - 1]!, plan.tasks[i]!];
      expect(new Set(three.map((task) => task.type)).size).toBeGreaterThan(1);
    }
  });

  it("always produces something, even when everything is green and nothing is due", () => {
    const plan = buildPlan(input({ rag: ragAll("GREEN") }));
    expect(plan.tasks.length).toBeGreaterThanOrEqual(1);
  });
});

describe("duration personalisation", () => {
  it("is neutral with no history", () => {
    expect(durationRatio([])).toBe(1);
  });

  it("follows a student who consistently takes longer", () => {
    const history = Array.from({ length: 10 }, () => ({
      date: agoDays(1),
      taskType: "QUESTIONS" as const,
      status: "DONE" as const,
      estMinutes: 10,
      actualMinutes: 15,
    }));
    expect(durationRatio(history)).toBeCloseTo(1.5, 5);
  });

  it("is clamped, so one abandoned tab does not distort every plan", () => {
    const history = Array.from({ length: 5 }, () => ({
      date: agoDays(1),
      taskType: "QUESTIONS" as const,
      status: "DONE" as const,
      estMinutes: 1,
      actualMinutes: 600,
    }));
    expect(durationRatio(history)).toBeLessThanOrEqual(1.8);
  });

  it("shrinks the plan for a slower student", () => {
    const slow = Array.from({ length: 10 }, () => ({
      date: agoDays(1),
      taskType: "QUESTIONS" as const,
      status: "DONE" as const,
      estMinutes: 10,
      actualMinutes: 17,
    }));

    const normal = buildPlan(input({ targetMinutes: 60 }));
    const adjusted = buildPlan(input({ targetMinutes: 60, recentHistory: slow }));

    // Same budget, fewer or smaller things in it.
    expect(adjusted.tasks.length).toBeLessThanOrEqual(normal.tasks.length);
    expect(adjusted.totalEstMinutes).toBeLessThanOrEqual(60 * PACKING.overrun);
  });
});

describe("not repeating yesterday", () => {
  it("penalises the same sub-topic and task type within 48 hours", () => {
    const repeated = buildPlan(
      input({
        recentHistory: [
          {
            date: agoDays(1),
            taskType: "QUESTIONS",
            subTopicId: "bio-1",
            subjectId: "aqa-biology",
            status: "DONE",
          },
        ],
      }),
    );

    const fresh = buildPlan(input());

    const bioQuestions = (plan: ReturnType<typeof buildPlan>) =>
      plan.tasks.findIndex((task) => task.type === "QUESTIONS" && task.subTopicId === "bio-1");

    const before = bioQuestions(fresh);
    const after = bioQuestions(repeated);

    // Either pushed down the list or dropped from it.
    expect(after === -1 || before === -1 || after >= before).toBe(true);
  });

  it("does not penalise flashcards, which are meant to recur", () => {
    const plan = buildPlan(
      input({
        dueCards: { total: 20, overdueDays: [3], bySubject: { "aqa-biology": 20 } },
        recentHistory: [
          {
            date: agoDays(1),
            taskType: "FLASHCARDS",
            subjectId: "aqa-biology",
            status: "DONE",
          },
        ],
      }),
    );
    expect(plan.tasks[0]?.type).toBe("FLASHCARDS");
  });
});

describe("cold start (doc 05 §7)", () => {
  it("front-loads diagnostics for a new account", () => {
    const plan = buildPlan(
      input({
        accountAgeDays: 1,
        rag: [
          { scope: "SUBTOPIC", id: "bio-1", value: "AMBER" },
          { scope: "SUBTOPIC", id: "bio-2", value: "GREEN" },
          { scope: "SUBTOPIC", id: "chem-1", value: "GREEN" },
        ],
        targetMinutes: 90,
      }),
    );
    expect(plan.tasks.some((task) => task.type === "DIAGNOSTIC")).toBe(true);
  });

  it("stops once the account has some history", () => {
    const plan = buildPlan(input({ accountAgeDays: 30, rag: ragAll("GREEN") }));
    expect(plan.tasks.some((task) => task.type === "DIAGNOSTIC")).toBe(false);
  });
});

describe("deep links (doc 05 §10)", () => {
  it("resolve to the exact work, carrying the task id", () => {
    const plan = buildPlan(
      input({
        targetMinutes: 120,
        dueCards: { total: 10, overdueDays: [1], bySubject: { "aqa-biology": 10 } },
      }),
    );

    for (const task of plan.tasks) {
      const href = targetHref(task, "abc");

      if (task.type === "FLASHCARDS") expect(href).toBe("/revise/flashcards?task=abc");
      if (task.type === "LESSON")
        expect(href).toMatch(/^\/learn\/[a-z]+\/[\w-]+\/[\w-]+\?task=abc$/);
      if (task.type === "NOTES") expect(href).toMatch(/^\/revise\/[a-z]+\/notes\//);
      if (task.type === "BLURT") expect(href).toMatch(/^\/revise\/blurt\//);
      if (task.type === "QUESTIONS") expect(href).toMatch(/^\/test\/practice\//);
    }
  });
});
