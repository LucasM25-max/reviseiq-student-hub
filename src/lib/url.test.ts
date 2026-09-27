import { afterEach, describe, expect, it, vi } from "vitest";

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

/**
 * The scheme behind a TLS-terminating proxy.
 *
 * Next populates `x-forwarded-proto` itself when the proxy leaves it out, filling in
 * the scheme of the hop into the server rather than the one the browser used. Getting
 * this wrong put `http://` into redirects and verification emails, which browsers
 * refuse as mixed content once the page itself is HTTPS.
 */
describe("requestOrigin", () => {
  async function originFor(headerPairs: Record<string, string>) {
    vi.resetModules();
    vi.doMock("next/headers", () => ({
      headers: async () => new Headers(headerPairs),
    }));
    const { requestOrigin } = await import("@/lib/url");
    return requestOrigin();
  }

  afterEach(() => {
    vi.doUnmock("next/headers");
    vi.resetModules();
  });

  it("keeps loopback on http so local development still works", async () => {
    for (const host of ["localhost:3000", "127.0.0.1:3000", "[::1]:3000"]) {
      expect(await originFor({ host, "x-forwarded-proto": "http" })).toBe(`http://${host}`);
    }
  });

  it("treats any public host as https even when the proxy reports http", async () => {
    expect(await originFor({ host: "3000-abc.e2b.app", "x-forwarded-proto": "http" })).toBe(
      "https://3000-abc.e2b.app",
    );
    expect(await originFor({ host: "reviseiq.app" })).toBe("https://reviseiq.app");
  });

  it("prefers the forwarded host over the server's own", async () => {
    expect(
      await originFor({ host: "localhost:3000", "x-forwarded-host": "3000-abc.e2b.app" }),
    ).toBe("https://3000-abc.e2b.app");
  });

  it("takes the first hop when the header has been appended to", async () => {
    expect(await originFor({ host: "reviseiq.app", "x-forwarded-proto": "https, http" })).toBe(
      "https://reviseiq.app",
    );
  });

  it("falls back to the configured URL when there is no host at all", async () => {
    expect(await originFor({})).toBe("http://localhost:3000");
  });
});
