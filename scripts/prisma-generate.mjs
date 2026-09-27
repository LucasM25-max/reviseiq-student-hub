#!/usr/bin/env node
/**
 * Runs `prisma generate`, with a fallback for environments that can't reach Prisma's
 * binary CDN.
 *
 * Prisma 7's CLI downloads a native schema engine from binaries.prisma.sh on first use.
 * `generate` never actually *executes* that engine — it only checks that the path
 * resolves — so when the download is blocked (offline CI, restricted networks, this
 * development sandbox) pointing PRISMA_SCHEMA_ENGINE_BINARY at a local placeholder is
 * enough to get a correct client generated.
 *
 * The normal path is tried first, so anywhere with network access behaves exactly as
 * upstream intends and the fallback never runs.
 */

import { spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const STUB_DIR = path.join(process.cwd(), ".prisma-stub");
const STUB_PATH = path.join(STUB_DIR, "schema-engine");

/** Errors that mean "couldn't fetch the engine", as opposed to a real schema problem. */
const NETWORK_MARKERS = [
  "binaries.prisma.sh",
  "Client network socket disconnected",
  "ENOTFOUND",
  "ETIMEDOUT",
  "ECONNREFUSED",
  "getaddrinfo",
  "Failed to fetch the engine file",
];

/**
 * npm puts node_modules/.bin on PATH for lifecycle scripts, but not when this file is
 * run directly with `node`. Resolving it explicitly makes both work.
 */
function prismaBin() {
  const local = path.join(
    process.cwd(),
    "node_modules",
    ".bin",
    process.platform === "win32" ? "prisma.cmd" : "prisma",
  );
  return existsSync(local) ? local : "prisma";
}

function run(env) {
  return spawnSync(prismaBin(), ["generate"], {
    stdio: ["ignore", "pipe", "pipe"],
    encoding: "utf8",
    env: { ...process.env, ...env },
  });
}

function report(result) {
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.error) process.stderr.write(`${result.error.message}\n`);
}

function ensureStub() {
  if (existsSync(STUB_PATH)) return;
  mkdirSync(STUB_DIR, { recursive: true });
  writeFileSync(
    STUB_PATH,
    '#!/bin/sh\necho "schema-engine stub: unavailable in this environment" >&2\nexit 1\n',
    "utf8",
  );
  chmodSync(STUB_PATH, 0o755);
}

const first = run({});

if (first.status === 0) {
  report(first);
  process.exit(0);
}

const output = `${first.stdout ?? ""}${first.stderr ?? ""}`;
const looksLikeNetwork = NETWORK_MARKERS.some((marker) => output.includes(marker));

if (!looksLikeNetwork) {
  // A genuine failure — bad schema, missing CLI, anything else. Surface it as-is.
  report(first);
  process.exit(first.status ?? 1);
}

console.warn(
  "[prisma] Could not download the schema engine. Retrying with a local placeholder —\n" +
    "[prisma] `generate` does not execute it. `migrate` is unavailable in this environment;\n" +
    "[prisma] use `npm run db:migrate` (scripts/db-migrate.mjs) instead.",
);

ensureStub();

const second = run({ PRISMA_SCHEMA_ENGINE_BINARY: STUB_PATH });
report(second);
process.exit(second.status ?? 1);
