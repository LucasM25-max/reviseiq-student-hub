import { describe, expect, it } from "vitest";

import { RagValue } from "@/generated/prisma/enums";
import { RAG_CLASSES, RAG_META, RAG_ORDER, subjectClasses, SUBJECT_CLASSES } from "@/lib/rag";

describe("RAG metadata", () => {
  it("covers every value the database can hold", () => {
    expect([...RAG_ORDER].sort()).toEqual(Object.values(RagValue).sort());
  });

  it("puts the states in the order the product describes them", () => {
    expect(RAG_ORDER).toEqual(["NOT_LEARNT", "RED", "AMBER", "GREEN"]);
  });

  it("gives each state a label and an explanation of what it causes", () => {
    for (const value of RAG_ORDER) {
      const meta = RAG_META[value];
      expect(meta.value).toBe(value);
      expect(meta.label.length).toBeGreaterThan(0);
      // Every rating must tell the student what it will actually do.
      expect(meta.consequence.length).toBeGreaterThan(10);
    }
  });

  it("assigns a unique keyboard shortcut to each state", () => {
    const keys = RAG_ORDER.map((value) => RAG_META[value].key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("has styling for every state", () => {
    for (const value of RAG_ORDER) {
      const classes = RAG_CLASSES[value];
      expect(classes.selected).toContain(RAG_META[value].token);
      expect(classes.dot).toContain(RAG_META[value].token);
      expect(classes.idle.length).toBeGreaterThan(0);
      expect(classes.badge.length).toBeGreaterThan(0);
    }
  });
});

describe("subject accents", () => {
  it("covers the three sciences", () => {
    expect(Object.keys(SUBJECT_CLASSES).sort()).toEqual(["biology", "chemistry", "physics"]);
  });

  it("falls back rather than rendering undefined classes", () => {
    expect(subjectClasses("not-a-subject")).toBe(SUBJECT_CLASSES.biology);
    expect(subjectClasses("physics")).toBe(SUBJECT_CLASSES.physics);
  });
});
