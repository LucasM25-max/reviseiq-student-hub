import "dotenv/config";
import path from "node:path";
import { defineConfig, env } from "prisma/config";

/**
 * Prisma 7 configuration.
 *
 * The connection URL lives here rather than in schema.prisma — Prisma 7 removed
 * `datasource.url` from the schema file. The application client connects through a
 * driver adapter instead (see src/lib/db/prisma.ts).
 */
export default defineConfig({
  schema: path.join("prisma", "schema.prisma"),
  datasource: {
    url: env("DATABASE_URL"),
  },
  migrations: {
    path: path.join("prisma", "migrations"),
    seed: "tsx prisma/seed.ts",
  },
});
