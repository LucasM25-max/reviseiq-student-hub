import { describe, expect, it } from "vitest";

import {
  checkPasswordStrength,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
} from "@/lib/auth/password-policy";

describe("checkPasswordStrength", () => {
  it("accepts a reasonable passphrase", () => {
    expect(checkPasswordStrength("correct horse battery staple")).toBeNull();
    expect(checkPasswordStrength("Mitochondria!7Farm")).toBeNull();
  });

  it("requires a minimum length", () => {
    expect(checkPasswordStrength("short1!")).toContain(String(PASSWORD_MIN_LENGTH));
    expect(checkPasswordStrength("a".repeat(PASSWORD_MIN_LENGTH - 1))).not.toBeNull();
  });

  it("rejects an absurdly long password", () => {
    expect(checkPasswordStrength("a1B!".repeat(200))).toContain(String(PASSWORD_MAX_LENGTH));
  });

  it("rejects the common passwords a teenager actually picks", () => {
    for (const password of ["password123", "Password123", "qwerty12345", "liverpool1"]) {
      expect(checkPasswordStrength(password), password).not.toBeNull();
    }
  });

  it("ignores punctuation and case when matching the blocklist", () => {
    expect(checkPasswordStrength("P-a.s.s.w.o.r.d.1.2.3")).not.toBeNull();
  });

  it("rejects a password made of only a couple of characters", () => {
    expect(checkPasswordStrength("ababababab")).toContain("repetitive");
    expect(checkPasswordStrength("aaaaaaaaaaaa")).toContain("repetitive");
  });

  it("rejects a straight run of consecutive characters", () => {
    expect(checkPasswordStrength("abcdefghijkl")).toContain("sequences");
    expect(checkPasswordStrength("9876543210")).toContain("sequences");
  });

  it("allows a sequence that is only part of the password", () => {
    expect(checkPasswordStrength("abcde-photosynthesis")).toBeNull();
  });

  it("rejects a password built from the email address", () => {
    expect(checkPasswordStrength("jasmine-khan-99", "jasmine@school.uk")).not.toBeNull();
    expect(checkPasswordStrength("JASMINEsomething", "jasmine@school.uk")).not.toBeNull();
  });

  it("ignores very short email local parts", () => {
    // "jo" is too short to be a meaningful signal and would reject half the dictionary.
    expect(checkPasswordStrength("jovial wombat parade", "jo@school.uk")).toBeNull();
  });
});
