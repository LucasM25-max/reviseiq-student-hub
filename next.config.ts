import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Dev is often served through a proxy on a different host (sandboxes, tunnels,
  // preview URLs). Without this, Next refuses their cross-origin dev asset requests.
  allowedDevOrigins: ["*.e2b.app", "*.vercel.app", "localhost", "127.0.0.1"],

  // @node-rs/argon2 is a native addon: it must stay external to the server bundle.
  serverExternalPackages: ["@node-rs/argon2"],

  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // Nothing in ReviseIQ should ever be framed by a third party.
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
