/**
 * Stand-in for the `server-only` package under Vitest.
 *
 * The real module throws when it is pulled into a client bundle. Tests run in Node, so
 * importing it is legitimate — aliasing it here keeps the guard intact in application
 * code while letting server modules be unit-tested directly.
 */
export {};
