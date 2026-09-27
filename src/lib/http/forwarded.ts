/**
 * Working out the origin the browser is actually using, from proxy headers.
 *
 * Shared by the edge proxy and the server-side URL helpers so the two cannot drift.
 * They did drift once: the proxy trusted `x-forwarded-proto` outright while the URL
 * helper inferred the scheme from the host. Behind a TLS-terminating proxy that put
 * an `http://` redirect in front of an HTTPS page, and the browser blocked it as
 * mixed content — a navigation died silently and a server action's `fetch` rejected
 * with "Failed to fetch".
 *
 * Must stay free of `server-only`, Node built-ins and `next/*`: the edge runtime
 * imports this module.
 */

/**
 * The host without its port.
 *
 * IPv6 needs care: `[::1]:3000` carries the address in brackets, and a bare `::1`
 * ends in something that looks exactly like a port. Stripping naively turns `::1`
 * into `:`.
 */
function hostname(host: string): string {
  const trimmed = host.trim().toLowerCase();

  const bracketed = /^\[(.+)\](?::\d+)?$/.exec(trimmed);
  if (bracketed) return bracketed[1] ?? trimmed;

  // More than one colon means a bare IPv6 literal, which cannot also carry a port.
  if ((trimmed.match(/:/g)?.length ?? 0) > 1) return trimmed;

  return trimmed.replace(/:\d+$/, "");
}

/** The only hosts we ever serve over plain HTTP. */
export function isLoopbackHost(host: string): boolean {
  const name = hostname(host);
  return (
    name === "localhost" ||
    name.endsWith(".localhost") ||
    name === "127.0.0.1" ||
    name === "0.0.0.0" ||
    name === "::1"
  );
}

/**
 * `x-forwarded-proto` is believed only when it says https.
 *
 * Next sets that header itself when the proxy leaves it out, and fills in the scheme
 * of the hop into *this* server — which behind a TLS-terminating proxy is plain HTTP.
 * So `http` is not evidence the browser is on HTTP; it is the default. Anything that
 * is not loopback is public, and everything public is served over HTTPS.
 */
export function publicProtocol(forwardedProto: string | null, host: string): "http" | "https" {
  const first = forwardedProto?.split(",")[0]?.trim().toLowerCase();
  if (first === "https") return "https";
  return isLoopbackHost(host) ? "http" : "https";
}

/**
 * The public origin, or null when the request carries no host at all — callers decide
 * their own fallback. `x-forwarded-host` wins over `host`: it is the proxy's statement
 * of the name the browser used.
 */
export function publicOrigin(
  forwardedHost: string | null,
  hostHeader: string | null,
  forwardedProto: string | null,
): string | null {
  const host = forwardedHost?.split(",")[0]?.trim() || hostHeader?.trim();
  if (!host) return null;
  return `${publicProtocol(forwardedProto, host)}://${host}`;
}
