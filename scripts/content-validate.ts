/**
 * `npm run content:validate`
 *
 * Parses every file in /content, cross-references every id, and applies the coverage
 * gates. Exits non-zero on any error, which is what makes CI fail on a broken content
 * file. Warnings are printed but do not fail — see src/lib/content/coverage.ts for why.
 *
 * Needs no database. It is the fast gate that runs before anything is seeded.
 *
 * The logic lives in src/lib/content/validate-cli.ts so the same code path can be run
 * over the deliberately broken fixture in tests/fixtures/broken-content/.
 */
import { runValidation } from "../src/lib/content/validate-cli";

process.exitCode = runValidation();
