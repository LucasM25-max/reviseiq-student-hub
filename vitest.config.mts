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
      // The `next` package has no `exports` map, so a bare ESM import of `next/server`
      // — which next-auth does — cannot be resolved without the extension. Next's own
      // bundler resolves it; Vite needs telling. Without this, importing anything that
      // transitively reaches the auth layer fails at module load.
      "next/server": path.resolve(import.meta.dirname, "./node_modules/next/server.js"),
    },
  },
  test: {
    environment: "node",
    globals: false,
    server: {
      deps: {
        // Externalised dependencies are resolved by Node, which ignores the aliases
        // above. next-auth has to go through Vite for the `next/server` alias to take
        // effect — otherwise anything that transitively imports a server action (every
        // interactive component) cannot be loaded in a test at all.
        inline: ["next-auth", "@auth/core"],
      },
    },
    setupFiles: ["./tests/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}", "tests/**/*.test.{ts,tsx}"],
    // The database round-trip suite opens real connections; give it room.
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
