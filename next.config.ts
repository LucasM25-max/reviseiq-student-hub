import type { NextConfig } from "next";

/**
 * Hosts that may serve the app besides the one it is bound to.
 *
 * Behind a reverse proxy — a preview sandbox, a tunnel, a load balancer — the browser's
 * Origin is the public host while the server only knows its own. Next compares the two
 * on every Server Action and rejects the request as CSRF when they differ, which breaks
 * every form. Listing the public hosts here tells Next those origins are expected.
 *
 * Production origins are supplied through the environment so nothing is hard-coded.
 */
const proxiedOrigins = [
  ...(process.env.ALLOWED_ORIGINS?.split(",").map((value) => value.trim()) ?? []),
  ...[process.env.AUTH_URL, process.env.NEXT_PUBLIC_APP_URL]
    .filter((value): value is string => Boolean(value))
    .map((value) => {
      try {
        return new URL(value).host;
      } catch {
        return null;
      }
    })
    .filter((value): value is string => value !== null),
  "*.e2b.app",
  "*.vercel.app",
  "localhost:3000",
  "127.0.0.1:3000",
].filter(Boolean);

const isProduction = process.env.NODE_ENV === "production";

const nextConfig: NextConfig = {
  // Dev is often served through a proxy on a different host (sandboxes, tunnels,
  // preview URLs). Without this, Next refuses their cross-origin dev asset requests.
  allowedDevOrigins: ["*.e2b.app", "*.vercel.app", "localhost", "127.0.0.1"],

  experimental: {
    serverActions: {
      allowedOrigins: proxiedOrigins,
    },
  },

  // @node-rs/argon2 is a native addon: it must stay external to the server bundle.
  serverExternalPackages: ["@node-rs/argon2"],

  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
          },
          // Nothing in ReviseIQ should be framed by a third party in production.
          // `frame-ancestors` supersedes X-Frame-Options and, unlike it, can be
          // relaxed for development so preview panes can embed the app.
          ...(isProduction
            ? [{ key: "Content-Security-Policy", value: "frame-ancestors 'self'" }]
            : []),
        ],
      },
    ];
  },
};

export default nextConfig;
