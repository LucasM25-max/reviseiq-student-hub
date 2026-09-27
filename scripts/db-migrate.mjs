#!/usr/bin/env node
/**
 * Applies the SQL migrations in prisma/migrations, recording them in Prisma's own
 * `_prisma_migrations` ledger with matching checksums.
 *
 * Why this exists: `prisma migrate` shells out to a native Rust schema engine that it
 * downloads from binaries.prisma.sh at run time. That host is unreachable from this
 * development sandbox, so the CLI cannot run here. The migration files themselves are
 * ordinary Prisma migrations — in CI and in production (where the download works)
 * `prisma migrate deploy` reads the same files and agrees with the same checksums, so
 * nothing about the deployment path is special-cased.
 *
 *   node scripts/db-migrate.mjs           apply any pending migrations
 *   node scripts/db-migrate.mjs --status  list applied / pending without changing anything
 */
import "dotenv/config";
import { createHash, randomUUID } from "node:crypto";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import pg from "pg";

const MIGRATIONS_DIR = path.join(process.cwd(), "prisma", "migrations");

const LEDGER_DDL = `
CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
  "id"                    VARCHAR(36) PRIMARY KEY NOT NULL,
  "checksum"              VARCHAR(64) NOT NULL,
  "finished_at"           TIMESTAMPTZ,
  "migration_name"        VARCHAR(255) NOT NULL,
  "logs"                  TEXT,
  "rolled_back_at"        TIMESTAMPTZ,
  "started_at"            TIMESTAMPTZ NOT NULL DEFAULT now(),
  "applied_steps_count"   INTEGER NOT NULL DEFAULT 0
);`;

function discoverMigrations() {
  let entries;
  try {
    entries = readdirSync(MIGRATIONS_DIR);
  } catch {
    return [];
  }
  return entries
    .filter((name) => statSync(path.join(MIGRATIONS_DIR, name)).isDirectory())
    .sort()
    .map((name) => {
      const sql = readFileSync(path.join(MIGRATIONS_DIR, name, "migration.sql"), "utf8");
      return { name, sql, checksum: createHash("sha256").update(sql).digest("hex") };
    });
}

async function main() {
  const statusOnly = process.argv.includes("--status");
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    console.error("DATABASE_URL is not set. Copy .env.example to .env first.");
    process.exit(1);
  }

  const migrations = discoverMigrations();
  if (migrations.length === 0) {
    console.log("[migrate] no migrations found");
    return;
  }

  const client = new pg.Client({ connectionString });
  await client.connect();

  try {
    await client.query(LEDGER_DDL);

    const { rows } = await client.query(
      'SELECT "migration_name", "checksum", "finished_at" FROM "_prisma_migrations"',
    );
    const applied = new Map(rows.map((row) => [row.migration_name, row]));

    let pending = 0;

    for (const migration of migrations) {
      const record = applied.get(migration.name);

      if (record?.finished_at) {
        if (record.checksum !== migration.checksum) {
          console.error(
            `[migrate] checksum mismatch for ${migration.name}.\n` +
              "  The migration file changed after it was applied. Applied migrations are " +
              "immutable — add a new migration instead, or run `npm run db:reset` locally.",
          );
          process.exitCode = 1;
          return;
        }
        if (statusOnly) console.log(`  applied  ${migration.name}`);
        continue;
      }

      pending += 1;

      if (statusOnly) {
        console.log(`  PENDING  ${migration.name}`);
        continue;
      }

      process.stdout.write(`[migrate] applying ${migration.name} ... `);
      const startedAt = new Date();

      try {
        await client.query("BEGIN");
        await client.query(migration.sql);
        await client.query(
          `INSERT INTO "_prisma_migrations"
             ("id","checksum","finished_at","migration_name","started_at","applied_steps_count")
           VALUES ($1,$2,now(),$3,$4,1)`,
          [randomUUID(), migration.checksum, migration.name, startedAt],
        );
        await client.query("COMMIT");
        process.stdout.write("done\n");
      } catch (error) {
        await client.query("ROLLBACK");
        process.stdout.write("FAILED\n");
        throw error;
      }
    }

    if (statusOnly) {
      console.log(`[migrate] ${migrations.length - pending} applied, ${pending} pending`);
    } else if (pending === 0) {
      console.log("[migrate] database is up to date");
    } else {
      console.log(`[migrate] applied ${pending} migration(s)`);
    }
  } finally {
    await client.end();
  }
}

await main();
