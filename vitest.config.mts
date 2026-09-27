import path from "node:path";

import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
      "@content": path.resolve(import.meta.dirname, "./content"),
      // `server-only` throws by design outside a React Server Component. Under Vitest we
      // *are* on the server, so it is replaced with a no-op rather than weakening the
      // guard in application code.
      "server-only": path.resolve(import.meta.dirname, "./tests/stubs/server-only.ts"),
    },
  },
  test: {
    environment: "node",
    globals: false,
    setupFiles: ["./tests/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}", "tests/**/*.test.{ts,tsx}"],
    // The database round-trip suite opens real connections; give it room.
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
