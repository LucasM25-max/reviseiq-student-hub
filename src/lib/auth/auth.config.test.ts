import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * The cookie flags are decided once, at module load, from the environment. Each case
 * therefore has to reset the module registry and re-import rather than reuse a binding.
 */
async function loadConfig(sandbox: string | undefined) {
  vi.resetModules();
  if (sandbox === undefined) vi.stubEnv("E2B_SANDBOX", "");
  else vi.stubEnv("E2B_SANDBOX", sandbox);
  const mod = await import("@/lib/auth/auth.config");
  return mod.authConfig;
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("auth cookie policy", () => {
  it("uses cross-site cookies inside the embedded preview sandbox", async () => {
    const config = await loadConfig("true");
    const cookies = (
      config as { cookies?: Record<string, { options: Record<string, unknown> }> }
    ).cookies;

    expect(cookies).toBeDefined();

    // Every cookie Auth.js round-trips has to survive the iframe, not just the session.
    expect(Object.keys(cookies ?? {}).sort()).toEqual(
      ["callbackUrl", "csrfToken", "nonce", "pkceCodeVerifier", "sessionToken", "state"].sort(),
    );

    for (const [name, cookie] of Object.entries(cookies ?? {})) {
      // SameSite=None is silently ignored by browsers unless Secure is set with it.
      expect(cookie.options.sameSite, `${name} sameSite`).toBe("none");
      expect(cookie.options.secure, `${name} secure`).toBe(true);
      expect(cookie.options.httpOnly, `${name} httpOnly`).toBe(true);
      expect(cookie.options.path, `${name} path`).toBe("/");
    }
  });

  it("leaves the Lax default alone everywhere else", async () => {
    for (const value of [undefined, "false"]) {
      const config = await loadConfig(value);
      expect(
        (config as { cookies?: unknown }).cookies,
        `E2B_SANDBOX=${String(value)}`,
      ).toBeUndefined();
    }
  });

  it("still trusts the proxied host", async () => {
    const config = await loadConfig("true");
    expect(config.trustHost).toBe(true);
  });
});
