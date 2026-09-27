#!/usr/bin/env node
/**
 * Local development database.
 *
 * Runs a real PostgreSQL server (the same engine we use in production on Neon) from the
 * `embedded-postgres` package, so no Docker and no root access are required.
 *
 * The data directory lives outside the repository by default so a multi-megabyte binary
 * data dir is never picked up by git or by workspace snapshots.
 *
 *   node scripts/dev-db.mjs start    start and stay in the foreground (Ctrl-C to stop)
 *   node scripts/dev-db.mjs stop     stop a server left running from a previous run
 *   node scripts/dev-db.mjs reset    delete the data directory entirely
 */
import EmbeddedPostgres from "embedded-postgres";
import { existsSync, rmSync } from "node:fs";
import { createConnection } from "node:net";

const DATA_DIR = process.env.DEV_DB_DIR ?? "/tmp/reviseiq-devdb";
const PORT = Number(process.env.DEV_DB_PORT ?? 55432);
const USER = "reviseiq";
const PASSWORD = "reviseiq";
const DATABASE = "reviseiq";

/** Resolves true when something is already listening on the dev database port. */
function portInUse(port) {
  return new Promise((resolve) => {
    const socket = createConnection({ host: "127.0.0.1", port });
    const done = (result) => {
      socket.removeAllListeners();
      socket.destroy();
      resolve(result);
    };
    socket.setTimeout(1000);
    socket.once("connect", () => done(true));
    socket.once("timeout", () => done(false));
    socket.once("error", () => done(false));
  });
}

function createServer() {
  return new EmbeddedPostgres({
    databaseDir: DATA_DIR,
    user: USER,
    password: PASSWORD,
    port: PORT,
    persistent: true,
    // embedded-postgres logs every statement at default verbosity; keep startup readable.
    onLog: (message) => {
      const text = String(message).trim();
      if (text && !text.includes("LOG:  statement:")) process.stdout.write(`${text}\n`);
    },
    onError: (message) => process.stderr.write(`${String(message).trim()}\n`),
  });
}

async function start() {
  if (await portInUse(PORT)) {
    console.log(`[dev-db] already listening on ${PORT} — reusing it`);
    // Stay alive so the caller's process supervision still has something to watch.
    await new Promise(() => {});
    return;
  }

  const pg = createServer();
  const firstRun = !existsSync(DATA_DIR);

  if (firstRun) {
    console.log(`[dev-db] initialising cluster in ${DATA_DIR}`);
    await pg.initialise();
  }

  await pg.start();

  if (firstRun) {
    await pg.createDatabase(DATABASE);
    console.log(`[dev-db] created database "${DATABASE}"`);
  }

  console.log(
    `[dev-db] ready — postgresql://${USER}:${PASSWORD}@127.0.0.1:${PORT}/${DATABASE}`,
  );

  let stopping = false;
  const shutdown = async (signal) => {
    if (stopping) return;
    stopping = true;
    console.log(`[dev-db] ${signal} received, stopping`);
    try {
      await pg.stop();
    } catch (error) {
      console.error("[dev-db] error while stopping:", error);
    }
    process.exit(0);
  };

  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));

  // Keep the process alive for as long as the server should run.
  await new Promise(() => {});
}

async function stop() {
  if (!existsSync(DATA_DIR)) {
    console.log("[dev-db] no data directory; nothing to stop");
    return;
  }
  const pg = createServer();
  try {
    await pg.stop();
    console.log("[dev-db] stopped");
  } catch (error) {
    console.log(`[dev-db] not running (${error instanceof Error ? error.message : error})`);
  }
}

async function reset() {
  await stop();
  rmSync(DATA_DIR, { recursive: true, force: true });
  console.log(`[dev-db] removed ${DATA_DIR}`);
}

const command = process.argv[2] ?? "start";
const commands = { start, stop, reset };

if (!(command in commands)) {
  console.error(`Unknown command "${command}". Expected: ${Object.keys(commands).join(", ")}`);
  process.exit(1);
}

await commands[command]();
