import { afterAll, describe, expect, it } from "vitest";

import type { Prisma } from "@/generated/prisma/client";
import {
  OnboardingStep,
  RagScope,
  RagSource,
  RagValue,
  ReminderChannel,
  Role,
  TierChoice,
  YearGroup,
} from "@/generated/prisma/enums";
import { prisma } from "@/lib/db/prisma";

/**
 * Database round-trip suite.
 *
 * Prisma's own `migrate` cannot run in every environment (its schema engine is a
 * downloaded native binary), so the initial migration is hand-authored SQL applied by
 * scripts/db-migrate.mjs. That leaves one thing that must never be taken on trust:
 * whether the SQL actually matches prisma/schema.prisma.
 *
 * This suite is the answer. It writes and reads back **every model and every field**,
 * round-trips **every value of every enum**, and exercises the unique constraints and
 * cascade deletes the application relies on. A column that is missing, misnamed, of the
 * wrong type, or nullable when it shouldn't be will fail here.
 *
 * Everything runs inside a transaction that is deliberately rolled back, so the suite
 * can be run repeatedly against a development database without leaving a trace.
 */

/** Sentinel used to abort — and therefore roll back — the transaction. */
class Rollback extends Error {
  constructor() {
    super("intentional rollback");
  }
}

type Tx = Prisma.TransactionClient;

async function inRolledBackTransaction(body: (tx: Tx) => Promise<void>): Promise<void> {
  try {
    await prisma.$transaction(
      async (tx) => {
        await body(tx);
        throw new Rollback();
      },
      { timeout: 25_000, maxWait: 10_000 },
    );
  } catch (error) {
    if (!(error instanceof Rollback)) throw error;
  }
}

const unique = () => Math.random().toString(36).slice(2, 10);

/**
 * Asserts that `body` violates a database constraint.
 *
 * A failed statement poisons the surrounding Postgres transaction — every later command
 * returns 25P02 until it ends. Wrapping the attempt in a savepoint rolls back just that
 * statement, so a test can check several constraints in sequence.
 */
let savepointCounter = 0;

async function expectRejection(tx: Tx, body: () => Promise<unknown>): Promise<void> {
  const name = `sp_${(savepointCounter += 1)}`;
  await tx.$executeRawUnsafe(`SAVEPOINT ${name}`);

  let threw = false;
  try {
    await body();
  } catch {
    threw = true;
  }

  await tx.$executeRawUnsafe(`ROLLBACK TO SAVEPOINT ${name}`);
  expect(threw, "expected the database to reject this write").toBe(true);
}

afterAll(async () => {
  await prisma.$disconnect();
});

describe("migration matches schema.prisma", () => {
  it("has applied the initial migration", async () => {
    const rows = await prisma.$queryRaw<{ migration_name: string; finished_at: Date | null }[]>`
      SELECT migration_name, finished_at FROM "_prisma_migrations" ORDER BY started_at ASC
    `;

    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0].migration_name).toBe("20260927110000_init");
    expect(rows.every((row) => row.finished_at !== null)).toBe(true);
  });

  it("exposes every model to the client", async () => {
    // A bare findFirst() selects every column the client believes exists, so a drifted
    // table fails immediately rather than at some unlucky moment in production.
    await Promise.all([
      prisma.user.findFirst(),
      prisma.account.findFirst(),
      prisma.session.findFirst(),
      prisma.verificationToken.findFirst(),
      prisma.authenticator.findFirst(),
      prisma.emailVerificationToken.findFirst(),
      prisma.passwordResetToken.findFirst(),
      prisma.rateBucket.findFirst(),
      prisma.studentProfile.findFirst(),
      prisma.subject.findFirst(),
      prisma.topic.findFirst(),
      prisma.subTopic.findFirst(),
      prisma.subjectEnrolment.findFirst(),
      prisma.examDate.findFirst(),
      prisma.ragRating.findFirst(),
      prisma.availabilitySlot.findFirst(),
    ]);
  });
});

describe("identity models", () => {
  it("round-trips every User field", async () => {
    await inRolledBackTransaction(async (tx) => {
      const emailVerified = new Date("2026-03-01T10:30:00.000Z");
      const dateOfBirth = new Date(Date.UTC(2010, 4, 17));
      const deletedAt = new Date("2026-09-01T00:00:00.000Z");

      const created = await tx.user.create({
        data: {
          email: `round-trip-${unique()}@example.test`,
          emailVerified,
          name: "Ada Lovelace",
          image: "https://example.test/avatar.png",
          passwordHash: "$argon2id$v=19$m=19456,t=2,p=1$abc$def",
          dateOfBirth,
          role: Role.ADMIN,
          deletedAt,
        },
      });

      expect(created.id).toMatch(/^[a-z0-9]+$/);
      expect(created.emailVerified?.toISOString()).toBe(emailVerified.toISOString());
      expect(created.name).toBe("Ada Lovelace");
      expect(created.image).toBe("https://example.test/avatar.png");
      expect(created.passwordHash).toContain("$argon2id$");
      // @db.Date must come back as midnight UTC, not shifted by the server timezone.
      expect(created.dateOfBirth?.toISOString()).toBe("2010-05-17T00:00:00.000Z");
      expect(created.role).toBe(Role.ADMIN);
      expect(created.deletedAt?.toISOString()).toBe(deletedAt.toISOString());
      expect(created.createdAt).toBeInstanceOf(Date);
      expect(created.updatedAt).toBeInstanceOf(Date);
    });
  });

  it("applies User defaults and nullability", async () => {
    await inRolledBackTransaction(async (tx) => {
      const created = await tx.user.create({
        data: { email: `minimal-${unique()}@example.test` },
      });

      expect(created.role).toBe(Role.STUDENT);
      expect(created.emailVerified).toBeNull();
      expect(created.name).toBeNull();
      expect(created.image).toBeNull();
      expect(created.passwordHash).toBeNull();
      expect(created.dateOfBirth).toBeNull();
      expect(created.deletedAt).toBeNull();
    });
  });

  it("enforces the unique email constraint", async () => {
    await inRolledBackTransaction(async (tx) => {
      const email = `duplicate-${unique()}@example.test`;
      await tx.user.create({ data: { email } });
      await expectRejection(tx, () => tx.user.create({ data: { email } }));
    });
  });

  it("round-trips Account, Session, VerificationToken and Authenticator", async () => {
    await inRolledBackTransaction(async (tx) => {
      const user = await tx.user.create({
        data: { email: `oauth-${unique()}@example.test` },
      });

      const account = await tx.account.create({
        data: {
          userId: user.id,
          type: "oauth",
          provider: "google",
          providerAccountId: `google-${unique()}`,
          refresh_token: "refresh-token-value",
          access_token: "access-token-value",
          expires_at: 1_800_000_000,
          token_type: "Bearer",
          scope: "openid email profile",
          id_token: "id-token-value",
          session_state: "session-state-value",
        },
      });

      expect(account.type).toBe("oauth");
      expect(account.expires_at).toBe(1_800_000_000);
      expect(account.scope).toBe("openid email profile");
      expect(account.session_state).toBe("session-state-value");

      const expires = new Date("2027-01-01T00:00:00.000Z");

      const session = await tx.session.create({
        data: { sessionToken: `token-${unique()}`, userId: user.id, expires },
      });
      expect(session.expires.toISOString()).toBe(expires.toISOString());

      const verification = await tx.verificationToken.create({
        data: {
          identifier: `id-${unique()}`,
          token: `tok-${unique()}`,
          expires,
        },
      });
      expect(verification.expires.toISOString()).toBe(expires.toISOString());

      const authenticator = await tx.authenticator.create({
        data: {
          credentialID: `cred-${unique()}`,
          userId: user.id,
          providerAccountId: `provider-${unique()}`,
          credentialPublicKey: "public-key",
          counter: 7,
          credentialDeviceType: "singleDevice",
          credentialBackedUp: true,
          transports: "usb,nfc",
        },
      });

      expect(authenticator.counter).toBe(7);
      expect(authenticator.credentialBackedUp).toBe(true);
      expect(authenticator.transports).toBe("usb,nfc");
    });
  });

  it("round-trips both hashed token tables", async () => {
    await inRolledBackTransaction(async (tx) => {
      const user = await tx.user.create({
        data: { email: `tokens-${unique()}@example.test` },
      });

      const expiresAt = new Date("2026-12-31T23:59:59.000Z");
      const usedAt = new Date("2026-12-01T09:00:00.000Z");

      const emailToken = await tx.emailVerificationToken.create({
        data: { userId: user.id, tokenHash: `hash-${unique()}`, expiresAt },
      });
      expect(emailToken.usedAt).toBeNull();
      expect(emailToken.expiresAt.toISOString()).toBe(expiresAt.toISOString());
      expect(emailToken.createdAt).toBeInstanceOf(Date);

      const resetToken = await tx.passwordResetToken.create({
        data: {
          userId: user.id,
          tokenHash: `hash-${unique()}`,
          expiresAt,
          usedAt,
        },
      });
      expect(resetToken.usedAt?.toISOString()).toBe(usedAt.toISOString());

      // tokenHash is the lookup key and must be unique across the table.
      await expectRejection(tx, () =>
        tx.emailVerificationToken.create({
          data: { userId: user.id, tokenHash: emailToken.tokenHash, expiresAt },
        }),
      );
    });
  });

  it("round-trips RateBucket", async () => {
    await inRolledBackTransaction(async (tx) => {
      const windowEnd = new Date(Date.now() + 60_000);
      const bucket = await tx.rateBucket.create({
        data: { key: `login:${unique()}`, count: 3, windowEnd },
      });

      expect(bucket.count).toBe(3);
      expect(bucket.windowEnd.toISOString()).toBe(windowEnd.toISOString());

      const defaulted = await tx.rateBucket.create({
        data: { key: `signup:${unique()}`, windowEnd },
      });
      expect(defaulted.count).toBe(0);
    });
  });
});

describe("student profile", () => {
  it("round-trips every StudentProfile field", async () => {
    await inRolledBackTransaction(async (tx) => {
      const user = await tx.user.create({
        data: { email: `profile-${unique()}@example.test` },
      });

      const onboardingCompletedAt = new Date("2026-09-20T12:00:00.000Z");
      const lastActiveDate = new Date(Date.UTC(2026, 8, 26));
      const examsCompletedAt = new Date("2027-06-15T16:00:00.000Z");
      const congratulationsSeenAt = new Date("2027-06-16T08:00:00.000Z");

      const profile = await tx.studentProfile.create({
        data: {
          userId: user.id,
          displayName: "Ada",
          timezone: "Europe/London",
          yearGroup: YearGroup.YEAR_10,
          dailyGoalMinutes: 45,
          holidayGoalMinutes: 90,
          onboardingStep: OnboardingStep.AVAILABILITY,
          onboardingCompletedAt,
          streakCurrent: 12,
          streakLongest: 31,
          streakFreezesLeft: 1,
          lastActiveDate,
          examsCompletedAt,
          congratulationsSeenAt,
          schedulingEnabled: false,
          reminderChannel: ReminderChannel.BOTH,
          reminderTimes: ["07:45", "18:30"],
          reduceMotion: true,
          dyslexiaFont: true,
          theme: "dark",
        },
      });

      expect(profile.displayName).toBe("Ada");
      expect(profile.timezone).toBe("Europe/London");
      expect(profile.yearGroup).toBe(YearGroup.YEAR_10);
      expect(profile.dailyGoalMinutes).toBe(45);
      expect(profile.holidayGoalMinutes).toBe(90);
      expect(profile.onboardingStep).toBe(OnboardingStep.AVAILABILITY);
      expect(profile.onboardingCompletedAt?.toISOString()).toBe(
        onboardingCompletedAt.toISOString(),
      );
      expect(profile.streakCurrent).toBe(12);
      expect(profile.streakLongest).toBe(31);
      expect(profile.streakFreezesLeft).toBe(1);
      expect(profile.lastActiveDate?.toISOString()).toBe("2026-09-26T00:00:00.000Z");
      expect(profile.examsCompletedAt?.toISOString()).toBe(examsCompletedAt.toISOString());
      expect(profile.congratulationsSeenAt?.toISOString()).toBe(
        congratulationsSeenAt.toISOString(),
      );
      expect(profile.schedulingEnabled).toBe(false);
      expect(profile.reminderChannel).toBe(ReminderChannel.BOTH);
      // String[] maps to a Postgres text[]; ordering must survive the round trip.
      expect(profile.reminderTimes).toEqual(["07:45", "18:30"]);
      expect(profile.reduceMotion).toBe(true);
      expect(profile.dyslexiaFont).toBe(true);
      expect(profile.theme).toBe("dark");
    });
  });

  it("applies StudentProfile defaults", async () => {
    await inRolledBackTransaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: `defaults-${unique()}@example.test`,
          profile: { create: {} },
        },
        include: { profile: true },
      });

      const profile = user.profile;
      expect(profile).not.toBeNull();
      expect(profile?.timezone).toBe("Europe/London");
      expect(profile?.yearGroup).toBe(YearGroup.YEAR_11);
      expect(profile?.dailyGoalMinutes).toBe(30);
      expect(profile?.holidayGoalMinutes).toBe(60);
      expect(profile?.onboardingStep).toBe(OnboardingStep.SUBJECTS);
      expect(profile?.onboardingCompletedAt).toBeNull();
      expect(profile?.streakCurrent).toBe(0);
      expect(profile?.streakLongest).toBe(0);
      expect(profile?.streakFreezesLeft).toBe(2);
      expect(profile?.lastActiveDate).toBeNull();
      expect(profile?.schedulingEnabled).toBe(true);
      expect(profile?.reminderChannel).toBe(ReminderChannel.NONE);
      expect(profile?.reminderTimes).toEqual([]);
      expect(profile?.reduceMotion).toBe(false);
      expect(profile?.dyslexiaFont).toBe(false);
      expect(profile?.theme).toBe("system");
    });
  });

  it("holds at most one profile per user", async () => {
    await inRolledBackTransaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: `one-profile-${unique()}@example.test`,
          profile: { create: {} },
        },
      });

      await expectRejection(tx, () => tx.studentProfile.create({ data: { userId: user.id } }));
    });
  });
});

describe("curriculum taxonomy", () => {
  it("has been seeded with three subjects and their topics", async () => {
    const subjects = await prisma.subject.findMany({
      orderBy: { order: "asc" },
      include: { topics: { orderBy: { order: "asc" } } },
    });

    expect(subjects.map((subject) => subject.code)).toEqual([
      "BIOLOGY",
      "CHEMISTRY",
      "PHYSICS",
    ]);
    expect(subjects.map((subject) => subject.qualCode)).toEqual(["8461", "8462", "8463"]);
    expect(subjects.map((subject) => subject.topics.length)).toEqual([7, 10, 8]);
    expect(subjects.every((subject) => subject.examBoard === "AQA")).toBe(true);

    for (const subject of subjects) {
      expect(subject.topics.every((topic) => topic.paper === 1 || topic.paper === 2)).toBe(
        true,
      );
      expect(subject.topics.map((topic) => topic.number)).toEqual(
        subject.topics.map((_, index) => index + 1),
      );
    }
  });

  it("round-trips SubTopic and enforces its unique code", async () => {
    await inRolledBackTransaction(async (tx) => {
      const topic = await tx.topic.findFirstOrThrow({ orderBy: { id: "asc" } });

      const subTopic = await tx.subTopic.create({
        data: {
          id: `${topic.id}-test-${unique()}`,
          topicId: topic.id,
          code: `4.1.${unique()}`,
          title: "A sub-topic used only by the test suite",
          order: 1,
        },
      });

      expect(subTopic.topicId).toBe(topic.id);
      expect(subTopic.order).toBe(1);

      await expectRejection(tx, () =>
        tx.subTopic.create({
          data: {
            id: `${topic.id}-clash-${unique()}`,
            topicId: topic.id,
            code: subTopic.code,
            title: "Duplicate code",
            order: 2,
          },
        }),
      );
    });
  });

  it("enforces the unique topic code per subject", async () => {
    await inRolledBackTransaction(async (tx) => {
      const topic = await tx.topic.findFirstOrThrow({ orderBy: { id: "asc" } });

      await expectRejection(tx, () =>
        tx.topic.create({
          data: {
            id: `clash-${unique()}`,
            subjectId: topic.subjectId,
            code: topic.code,
            number: 99,
            title: "Duplicate code",
            paper: 1,
            order: 99,
          },
        }),
      );
    });
  });
});

describe("student state", () => {
  it("round-trips SubjectEnrolment, ExamDate, RagRating and AvailabilitySlot", async () => {
    await inRolledBackTransaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: `state-${unique()}@example.test`,
          profile: { create: {} },
        },
      });

      const subject = await tx.subject.findFirstOrThrow({
        orderBy: { order: "asc" },
        include: { topics: { orderBy: { order: "asc" } } },
      });

      const enrolment = await tx.subjectEnrolment.create({
        data: {
          userId: user.id,
          subjectId: subject.id,
          tier: TierChoice.HIGHER,
          active: true,
        },
      });

      expect(enrolment.tier).toBe(TierChoice.HIGHER);
      expect(enrolment.active).toBe(true);
      expect(enrolment.createdAt).toBeInstanceOf(Date);
      expect(enrolment.updatedAt).toBeInstanceOf(Date);

      // One enrolment per subject per student.
      await expectRejection(tx, () =>
        tx.subjectEnrolment.create({
          data: { userId: user.id, subjectId: subject.id },
        }),
      );

      const examDate = await tx.examDate.create({
        data: {
          enrolmentId: enrolment.id,
          paper: 1,
          date: new Date(Date.UTC(2027, 4, 17)),
          confirmed: true,
        },
      });

      expect(examDate.paper).toBe(1);
      expect(examDate.confirmed).toBe(true);
      expect(examDate.date.toISOString()).toBe("2027-05-17T00:00:00.000Z");

      // One row per paper per enrolment.
      await expectRejection(tx, () =>
        tx.examDate.create({
          data: {
            enrolmentId: enrolment.id,
            paper: 1,
            date: new Date(Date.UTC(2027, 5, 1)),
          },
        }),
      );

      const topic = subject.topics[0];

      const topicRating = await tx.ragRating.create({
        data: {
          userId: user.id,
          scope: RagScope.TOPIC,
          topicId: topic.id,
          value: RagValue.AMBER,
          source: RagSource.USER,
        },
      });

      expect(topicRating.scope).toBe(RagScope.TOPIC);
      expect(topicRating.value).toBe(RagValue.AMBER);
      expect(topicRating.source).toBe(RagSource.USER);
      expect(topicRating.subTopicId).toBeNull();

      // One topic rating per student per topic.
      await expectRejection(tx, () =>
        tx.ragRating.create({
          data: {
            userId: user.id,
            scope: RagScope.TOPIC,
            topicId: topic.id,
            value: RagValue.RED,
          },
        }),
      );

      const subTopic = await tx.subTopic.create({
        data: {
          id: `${topic.id}-st-${unique()}`,
          topicId: topic.id,
          code: `st-${unique()}`,
          title: "Sub-topic",
          order: 1,
        },
      });

      const subTopicRating = await tx.ragRating.create({
        data: {
          userId: user.id,
          scope: RagScope.SUBTOPIC,
          subTopicId: subTopic.id,
          value: RagValue.GREEN,
          source: RagSource.SUGGESTED_ACCEPTED,
        },
      });

      expect(subTopicRating.topicId).toBeNull();
      expect(subTopicRating.source).toBe(RagSource.SUGGESTED_ACCEPTED);

      const slot = await tx.availabilitySlot.create({
        data: {
          userId: user.id,
          weekday: 3,
          minutes: 45,
          preferredStart: "17:30",
        },
      });

      expect(slot.weekday).toBe(3);
      expect(slot.minutes).toBe(45);
      expect(slot.preferredStart).toBe("17:30");

      // One slot per weekday per student.
      await expectRejection(tx, () =>
        tx.availabilitySlot.create({
          data: { userId: user.id, weekday: 3, minutes: 10 },
        }),
      );
    });
  });

  it("applies enrolment and rating defaults", async () => {
    await inRolledBackTransaction(async (tx) => {
      const user = await tx.user.create({
        data: { email: `def-${unique()}@example.test` },
      });
      const subject = await tx.subject.findFirstOrThrow({
        orderBy: { order: "asc" },
      });

      const enrolment = await tx.subjectEnrolment.create({
        data: { userId: user.id, subjectId: subject.id },
      });
      expect(enrolment.tier).toBe(TierChoice.UNSURE);
      expect(enrolment.active).toBe(true);

      const examDate = await tx.examDate.create({
        data: {
          enrolmentId: enrolment.id,
          paper: 2,
          date: new Date(Date.UTC(2027, 5, 7)),
        },
      });
      expect(examDate.confirmed).toBe(false);

      const topic = await tx.topic.findFirstOrThrow({
        where: { subjectId: subject.id },
      });
      const rating = await tx.ragRating.create({
        data: {
          userId: user.id,
          scope: RagScope.TOPIC,
          topicId: topic.id,
          value: RagValue.NOT_LEARNT,
        },
      });
      expect(rating.source).toBe(RagSource.USER);

      const slot = await tx.availabilitySlot.create({
        data: { userId: user.id, weekday: 0, minutes: 0 },
      });
      expect(slot.preferredStart).toBeNull();
    });
  });
});

describe("enums", () => {
  it("accepts every declared value", async () => {
    await inRolledBackTransaction(async (tx) => {
      const subject = await tx.subject.findFirstOrThrow({
        orderBy: { order: "asc" },
        include: { topics: { orderBy: { order: "asc" } } },
      });

      for (const role of Object.values(Role)) {
        const user = await tx.user.create({
          data: { email: `role-${role}-${unique()}@example.test`, role },
        });
        expect(user.role).toBe(role);
      }

      const user = await tx.user.create({
        data: {
          email: `enums-${unique()}@example.test`,
          profile: { create: {} },
        },
      });

      for (const yearGroup of Object.values(YearGroup)) {
        const updated = await tx.studentProfile.update({
          where: { userId: user.id },
          data: { yearGroup },
        });
        expect(updated.yearGroup).toBe(yearGroup);
      }

      for (const channel of Object.values(ReminderChannel)) {
        const updated = await tx.studentProfile.update({
          where: { userId: user.id },
          data: { reminderChannel: channel },
        });
        expect(updated.reminderChannel).toBe(channel);
      }

      for (const step of Object.values(OnboardingStep)) {
        const updated = await tx.studentProfile.update({
          where: { userId: user.id },
          data: { onboardingStep: step },
        });
        expect(updated.onboardingStep).toBe(step);
      }

      const enrolment = await tx.subjectEnrolment.create({
        data: { userId: user.id, subjectId: subject.id },
      });

      for (const tier of Object.values(TierChoice)) {
        const updated = await tx.subjectEnrolment.update({
          where: { id: enrolment.id },
          data: { tier },
        });
        expect(updated.tier).toBe(tier);
      }

      const rating = await tx.ragRating.create({
        data: {
          userId: user.id,
          scope: RagScope.TOPIC,
          topicId: subject.topics[0].id,
          value: RagValue.RED,
        },
      });

      for (const value of Object.values(RagValue)) {
        const updated = await tx.ragRating.update({
          where: { id: rating.id },
          data: { value },
        });
        expect(updated.value).toBe(value);
      }

      for (const source of Object.values(RagSource)) {
        const updated = await tx.ragRating.update({
          where: { id: rating.id },
          data: { source },
        });
        expect(updated.source).toBe(source);
      }

      for (const scope of Object.values(RagScope)) {
        const updated = await tx.ragRating.update({
          where: { id: rating.id },
          data: { scope },
        });
        expect(updated.scope).toBe(scope);
      }

      // SubjectCode is exercised by the seed; confirm the column really is the enum.
      const codes = await tx.subject.findMany({ select: { code: true } });
      expect(new Set(codes.map((row) => row.code))).toEqual(
        new Set(["BIOLOGY", "CHEMISTRY", "PHYSICS"]),
      );
    });
  });
});

describe("referential integrity", () => {
  it("cascades a user deletion across every owned table", async () => {
    await inRolledBackTransaction(async (tx) => {
      const subject = await tx.subject.findFirstOrThrow({
        orderBy: { order: "asc" },
        include: { topics: { orderBy: { order: "asc" } } },
      });

      const user = await tx.user.create({
        data: {
          email: `cascade-${unique()}@example.test`,
          profile: { create: {} },
          accounts: {
            create: {
              type: "oauth",
              provider: "google",
              providerAccountId: `cascade-${unique()}`,
            },
          },
          sessions: {
            create: { sessionToken: `s-${unique()}`, expires: new Date() },
          },
          authenticators: {
            create: {
              credentialID: `c-${unique()}`,
              providerAccountId: `p-${unique()}`,
              credentialPublicKey: "key",
              counter: 0,
              credentialDeviceType: "singleDevice",
              credentialBackedUp: false,
            },
          },
          emailVerificationTokens: {
            create: { tokenHash: `e-${unique()}`, expiresAt: new Date() },
          },
          passwordResetTokens: {
            create: { tokenHash: `p-${unique()}`, expiresAt: new Date() },
          },
          availability: { create: { weekday: 1, minutes: 30 } },
          ragRatings: {
            create: {
              scope: RagScope.TOPIC,
              topicId: subject.topics[0].id,
              value: RagValue.RED,
            },
          },
          enrolments: { create: { subjectId: subject.id } },
        },
        include: { enrolments: true },
      });

      await tx.examDate.create({
        data: {
          enrolmentId: user.enrolments[0].id,
          paper: 1,
          date: new Date(Date.UTC(2027, 4, 17)),
        },
      });

      await tx.user.delete({ where: { id: user.id } });

      const counts = await Promise.all([
        tx.studentProfile.count({ where: { userId: user.id } }),
        tx.account.count({ where: { userId: user.id } }),
        tx.session.count({ where: { userId: user.id } }),
        tx.authenticator.count({ where: { userId: user.id } }),
        tx.emailVerificationToken.count({ where: { userId: user.id } }),
        tx.passwordResetToken.count({ where: { userId: user.id } }),
        tx.availabilitySlot.count({ where: { userId: user.id } }),
        tx.ragRating.count({ where: { userId: user.id } }),
        tx.subjectEnrolment.count({ where: { userId: user.id } }),
        tx.examDate.count({ where: { enrolmentId: user.enrolments[0].id } }),
      ]);

      expect(counts).toEqual([0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);

      // The shared taxonomy must be untouched by a student leaving.
      expect(await tx.subject.count()).toBe(3);
    });
  });

  it("rejects rows pointing at a user that doesn't exist", async () => {
    await inRolledBackTransaction(async (tx) => {
      await expectRejection(tx, () =>
        tx.availabilitySlot.create({
          data: { userId: "no-such-user", weekday: 1, minutes: 30 },
        }),
      );
    });
  });
});
