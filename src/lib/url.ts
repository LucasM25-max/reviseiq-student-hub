import "server-only";

import { headers } from "next/headers";

import { env } from "@/lib/env";

/**
 * The origin the current request actually arrived on.
 *
 * Preferred over NEXT_PUBLIC_APP_URL for links we put in emails: preview deployments,
 * the sandboxed dev proxy and production all serve from different hosts, and a
 * verification link pointing at the wrong one is a dead end.
 */
export async function requestOrigin(): Promise<string> {
  const headerList = await headers();
  const host = headerList.get("x-forwarded-host") ?? headerList.get("host");

  if (!host) return env.NEXT_PUBLIC_APP_URL;

  const proto =
    headerList.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");

  return `${proto}://${host}`;
}

export async function absoluteUrl(path: string): Promise<string> {
  const origin = await requestOrigin();
  return new URL(path, origin).toString();
}

/** Best-effort client IP, used only as a rate-limit key. */
export async function clientIp(): Promise<string> {
  const headerList = await headers();
  const forwarded = headerList.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return headerList.get("x-real-ip")?.trim() || "unknown";
}

/**
 * Only same-origin, path-style destinations are allowed as post-login redirects, so a
 * crafted `?next=https://evil.example` cannot bounce a signed-in student off-site.
 */
export function safeRedirectPath(value: string | undefined | null, fallback: string): string {
  if (!value) return fallback;
  if (!value.startsWith("/")) return fallback;
  if (value.startsWith("//")) return fallback;
  if (value.includes("\\")) return fallback;
  return value;
}
