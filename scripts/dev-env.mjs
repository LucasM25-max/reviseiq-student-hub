#!/usr/bin/env node
/**
 * Creates .env for local development if it does not already exist.
 *
 *   node scripts/dev-env.mjs
 *
 * An existing .env is never touched.
 *
 * The development AUTH_SECRET is derived from the project path rather than generated
 * randomly. A random one means every recreated .env invalidates every session cookie,
 * so everyone signed in locally is silently logged out and, mid-onboarding, dumped back
 * at the login screen for no visible reason. Deriving it keeps sessions working across
 * restarts and clean checkouts.
 *
 * This value is for development only. Production must set its own AUTH_SECRET; the app
 * refuses to boot without one, and this script is never part of a deployment.
 */

import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const ENV_PATH = path.join(process.cwd(), ".env");
const EXAMPLE_PATH = path.join(process.cwd(), ".env.example");

if (existsSync(ENV_PATH)) {
  console.log("[env] .env already exists — leaving it alone");
  process.exit(0);
}

if (!existsSync(EXAMPLE_PATH)) {
  console.error("[env] .env.example is missing; cannot create .env");
  process.exit(1);
}

const secret = createHash("sha256")
  .update(`reviseiq-development-secret:${process.cwd()}`)
  .digest("base64");

const contents = readFileSync(EXAMPLE_PATH, "utf8").replace(
  /^AUTH_SECRET=""$/m,
  `AUTH_SECRET="${secret}"`,
);

if (!contents.includes(secret)) {
  console.error("[env] could not find an AUTH_SECRET line in .env.example to fill in");
  process.exit(1);
}

writeFileSync(ENV_PATH, contents, "utf8");
console.log("[env] wrote .env with a development AUTH_SECRET");
console.log("[env] set your own AUTH_SECRET before deploying anywhere real");
