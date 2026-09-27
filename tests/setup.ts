import "dotenv/config";

/**
 * Test environment defaults.
 *
 * Unit tests must not require a configured .env, so anything src/lib/env.ts insists on
 * gets a safe placeholder here. Real values from .env always win — the database
 * round-trip suite needs a genuine DATABASE_URL.
 */
// NODE_ENV is typed as read-only by @types/node; Vitest already sets it to "test".
process.env.AUTH_SECRET ||= "test-secret-at-least-thirty-two-characters-long";
process.env.DATABASE_URL ||= "postgresql://reviseiq:reviseiq@127.0.0.1:55432/reviseiq";
process.env.AUTH_URL ||= "http://localhost:3000";
process.env.NEXT_PUBLIC_APP_URL ||= "http://localhost:3000";
