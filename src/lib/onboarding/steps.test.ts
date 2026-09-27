import { describe, expect, it } from "vitest";

import {
  canVisit,
  furthestOf,
  nextStep,
  ONBOARDING_STEPS,
  STEP_META,
  stepIndex,
} from "@/lib/onboarding/steps";

describe("onboarding steps", () => {
  it("describes every step it lists", () => {
    for (const step of ONBOARDING_STEPS) {
      expect(STEP_META[step].title.length).toBeGreaterThan(0);
      expect(STEP_META[step].href.startsWith("/onboarding/")).toBe(true);
    }
  });

  it("orders the steps monotonically, with DONE last", () => {
    const indexes = ONBOARDING_STEPS.map(stepIndex);
    expect(indexes).toEqual([0, 1, 2, 3]);
    expect(stepIndex("DONE")).toBe(4);
  });

  it("walks forward and terminates at DONE", () => {
    expect(nextStep("SUBJECTS")).toBe("SETUP");
    expect(nextStep("SETUP")).toBe("RAG");
    expect(nextStep("RAG")).toBe("AVAILABILITY");
    expect(nextStep("AVAILABILITY")).toBe("DONE");
  });

  it("lets a student revisit any step they've reached", () => {
    expect(canVisit("SUBJECTS", "RAG")).toBe(true);
    expect(canVisit("SETUP", "RAG")).toBe(true);
    expect(canVisit("RAG", "RAG")).toBe(true);
  });

  it("blocks steps they haven't reached yet", () => {
    expect(canVisit("AVAILABILITY", "RAG")).toBe(false);
    expect(canVisit("RAG", "SUBJECTS")).toBe(false);
  });

  it("opens everything once onboarding is done", () => {
    for (const step of ONBOARDING_STEPS) {
      expect(canVisit(step, "DONE")).toBe(true);
    }
  });

  it("never rewinds progress when an earlier answer is edited", () => {
    expect(furthestOf("RAG", "SETUP")).toBe("RAG");
    expect(furthestOf("SETUP", "RAG")).toBe("RAG");
    expect(furthestOf("DONE", "SUBJECTS")).toBe("DONE");
    expect(furthestOf("SUBJECTS", "SUBJECTS")).toBe("SUBJECTS");
  });
});
