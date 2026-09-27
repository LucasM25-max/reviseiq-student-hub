import { describe, expect, it } from "vitest";

import { PAPERS, SUBJECTS, topicId } from "@/lib/curriculum/taxonomy";

describe("curriculum taxonomy", () => {
  it("covers the three separate sciences", () => {
    expect(SUBJECTS.map((subject) => subject.code)).toEqual([
      "BIOLOGY",
      "CHEMISTRY",
      "PHYSICS",
    ]);
  });

  it("carries the right AQA qualification codes", () => {
    expect(SUBJECTS.map((subject) => subject.qualCode)).toEqual(["8461", "8462", "8463"]);
  });

  it("matches the published topic counts", () => {
    expect(SUBJECTS.map((subject) => subject.topics.length)).toEqual([7, 10, 8]);
  });

  it("numbers topics from 1 with no gaps", () => {
    for (const subject of SUBJECTS) {
      expect(subject.topics.map((topic) => topic.number)).toEqual(
        subject.topics.map((_, index) => index + 1),
      );
    }
  });

  it("uses spec codes that match the topic number", () => {
    for (const subject of SUBJECTS) {
      for (const topic of subject.topics) {
        expect(topic.code).toBe(`4.${topic.number}`);
      }
    }
  });

  it("assigns every topic to a real paper, in order", () => {
    for (const subject of SUBJECTS) {
      const papers = subject.topics.map((topic) => topic.paper);
      expect(papers.every((paper) => PAPERS.includes(paper))).toBe(true);
      // Paper 1 topics always come before Paper 2 topics.
      expect([...papers].sort()).toEqual(papers);
    }
  });

  it("splits the papers where AQA does", () => {
    const split = Object.fromEntries(
      SUBJECTS.map((subject) => [
        subject.code,
        subject.topics.filter((topic) => topic.paper === 1).length,
      ]),
    );
    expect(split).toEqual({ BIOLOGY: 4, CHEMISTRY: 5, PHYSICS: 4 });
  });

  it("gives every subject a unique id, accent and order", () => {
    expect(new Set(SUBJECTS.map((subject) => subject.id)).size).toBe(SUBJECTS.length);
    expect(new Set(SUBJECTS.map((subject) => subject.accent)).size).toBe(SUBJECTS.length);
    expect(SUBJECTS.map((subject) => subject.order)).toEqual([1, 2, 3]);
  });

  it("builds stable, collision-free topic ids", () => {
    const ids = SUBJECTS.flatMap((subject) =>
      subject.topics.map((topic) => topicId(subject.id, topic.code)),
    );
    expect(new Set(ids).size).toBe(ids.length);
    expect(topicId("aqa-biology", "4.1")).toBe("aqa-biology-4.1");
  });

  it("has a non-empty title for every topic", () => {
    for (const subject of SUBJECTS) {
      for (const topic of subject.topics) {
        expect(topic.title.trim().length).toBeGreaterThan(0);
      }
    }
  });
});
