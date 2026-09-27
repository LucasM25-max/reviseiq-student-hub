import { describe, expect, it } from "vitest";

import { isLoopbackHost, publicOrigin, publicProtocol } from "@/lib/http/forwarded";

describe("isLoopbackHost", () => {
  it("recognises the loopback names, with or without a port", () => {
    for (const host of [
      "localhost",
      "localhost:3000",
      "app.localhost:3000",
      "127.0.0.1",
      "127.0.0.1:3000",
      "0.0.0.0:3000",
      "[::1]:3000",
      "::1",
      "LOCALHOST:3000",
    ]) {
      expect(isLoopbackHost(host), host).toBe(true);
    }
  });

  it("treats everything else as public", () => {
    for (const host of [
      "reviseiq.app",
      "3000-abc.e2b.app",
      "reviseiq.vercel.app",
      // Not loopback: a name that merely contains one.
      "localhost.evil.example",
      "notlocalhost",
    ]) {
      expect(isLoopbackHost(host), host).toBe(false);
    }
  });
});

describe("publicProtocol", () => {
  it("believes x-forwarded-proto when it says https", () => {
    expect(publicProtocol("https", "reviseiq.app")).toBe("https");
    expect(publicProtocol("https", "localhost:3000")).toBe("https");
    expect(publicProtocol("HTTPS", "reviseiq.app")).toBe("https");
    expect(publicProtocol("https, http", "reviseiq.app")).toBe("https");
  });

  /**
   * The regression this module exists for. Next sets x-forwarded-proto itself when
   * the proxy omits it, describing the hop into this server rather than the browser's.
   * Taking it at face value produced http:// redirects in front of an HTTPS page,
   * which the browser blocked as mixed content.
   */
  it("ignores a http claim for a public host", () => {
    expect(publicProtocol("http", "3000-abc.e2b.app")).toBe("https");
    expect(publicProtocol(null, "3000-abc.e2b.app")).toBe("https");
    expect(publicProtocol("", "reviseiq.app")).toBe("https");
  });

  it("keeps loopback on http so local development works", () => {
    expect(publicProtocol("http", "localhost:3000")).toBe("http");
    expect(publicProtocol(null, "127.0.0.1:3000")).toBe("http");
  });
});

describe("publicOrigin", () => {
  it("prefers the forwarded host over the server's own", () => {
    expect(publicOrigin("3000-abc.e2b.app", "localhost:3000", "http")).toBe(
      "https://3000-abc.e2b.app",
    );
  });

  it("falls back to the Host header", () => {
    expect(publicOrigin(null, "reviseiq.app", "https")).toBe("https://reviseiq.app");
  });

  it("takes the first hop when a header has been appended to", () => {
    expect(publicOrigin("3000-abc.e2b.app, inner", "localhost:3000", null)).toBe(
      "https://3000-abc.e2b.app",
    );
  });

  it("returns null when there is no host at all, so callers pick a fallback", () => {
    expect(publicOrigin(null, null, "https")).toBeNull();
    expect(publicOrigin("", "", null)).toBeNull();
  });
});
