/**
 * Runs the real content validator over one of the deliberately broken fixtures.
 *
 * Spawned as a subprocess by tests/content-cli.test.ts with the fixture name as argv[2].
 * This is the same `runValidation` that `npm run content:validate` calls, so the exit
 * code it produces is the exit code CI would produce for genuinely broken content.
 */
import { runValidation } from "../../../src/lib/content/validate-cli";

import { gatesBroken, referencesBroken, schemaBroken } from "./index";

const FIXTURES = {
  schema: schemaBroken,
  references: referencesBroken,
  gates: gatesBroken,
};

const name = process.argv[2] as keyof typeof FIXTURES | undefined;
if (!name || !(name in FIXTURES)) {
  console.error(`usage: validate-entry.ts <${Object.keys(FIXTURES).join("|")}>`);
  process.exit(2);
}

process.exitCode = runValidation(FIXTURES[name]);
