import { describe, expect, it } from "vitest";

import { safeRedirectPath } from "@/lib/url";

describe("safeRedirectPath", () => {
  it("keeps a same-origin path", () => {
    expect(safeRedirectPath("/today", "/fallback")).toBe("/today");
    expect(safeRedirectPath("/test/topic?task=42", "/fallback")).toBe("/test/topic?task=42");
  });

  it("falls back when nothing was supplied", () => {
    expect(safeRedirectPath(undefined, "/today")).toBe("/today");
    expect(safeRedirectPath(null, "/today")).toBe("/today");
    expect(safeRedirectPath("", "/today")).toBe("/today");
  });

  it("refuses an absolute URL", () => {
    expect(safeRedirectPath("https://evil.example/steal", "/today")).toBe("/today");
    expect(safeRedirectPath("http://evil.example", "/today")).toBe("/today");
  });

  it("refuses a protocol-relative URL", () => {
    expect(safeRedirectPath("//evil.example/steal", "/today")).toBe("/today");
  });

  it("refuses backslash tricks that some browsers normalise to //", () => {
    expect(safeRedirectPath("/\\evil.example", "/today")).toBe("/today");
    expect(safeRedirectPath("\\\\evil.example", "/today")).toBe("/today");
  });

  it("refuses a scheme-only payload", () => {
    expect(safeRedirectPath("javascript:alert(1)", "/today")).toBe("/today");
  });
});
