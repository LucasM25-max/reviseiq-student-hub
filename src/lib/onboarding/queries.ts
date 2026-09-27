import "server-only";

import { cache } from "react";

import { prisma } from "@/lib/db/prisma";

/** Every subject we offer, with topics, ordered for display. */
export const getCatalogue = cache(async () =>
  prisma.subject.findMany({
    orderBy: { order: "asc" },
    include: { topics: { orderBy: { order: "asc" } } },
  }),
);

/** The subjects this student is actually taking, with tier and exam dates. */
export const getEnrolments = cache(async (userId: string) =>
  prisma.subjectEnrolment.findMany({
    where: { userId, active: true },
    include: {
      subject: { include: { topics: { orderBy: { order: "asc" } } } },
      examDates: { orderBy: { paper: "asc" } },
    },
    orderBy: { subject: { order: "asc" } },
  }),
);

/** Topic-level RAG ratings, keyed by topic id for easy lookup in a render. */
export const getTopicRatings = cache(async (userId: string) => {
  const rows = await prisma.ragRating.findMany({
    where: { userId, scope: "TOPIC", topicId: { not: null } },
    select: { topicId: true, value: true },
  });

  const map = new Map<string, (typeof rows)[number]["value"]>();
  for (const row of rows) {
    if (row.topicId) map.set(row.topicId, row.value);
  }
  return map;
});

export const getAvailability = cache(async (userId: string) =>
  prisma.availabilitySlot.findMany({
    where: { userId },
    orderBy: { weekday: "asc" },
  }),
);
