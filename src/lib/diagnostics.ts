/**
 * Request tracing for the preview sandbox.
 *
 * Off unless PREVIEW_DIAGNOSTICS=1, and never on in a deployment. It exists because an
 * embedded preview is close to un-debuggable from the outside: the browser is on
 * another machine, the failure is a cookie that silently never arrives, and every layer
 * in between reports success. This prints what the server actually received so a single
 * click can be read back from the log instead of guessed at.
 *
 * Deliberately free of `server-only` and `next/*` so the edge proxy can use it too.
 * Never logs a cookie value or any part of a token — names and outcomes only.
 */

export const diagnosticsEnabled = process.env.PREVIEW_DIAGNOSTICS === "1";

export function trace(scope: string, fields: Record<string, unknown>): void {
  if (!diagnosticsEnabled) return;

  const rendered = Object.entries(fields)
    .map(([key, value]) => `${key}=${value ?? "—"}`)
    .join(" ");

  console.log(`[diag:${scope}] ${rendered}`);
}
