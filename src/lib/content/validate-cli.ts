/**
 * The body of `npm run content:validate`, extracted so it can be run over content other
 * than the repository's own.
 *
 * That matters for one specific reason: the roadmap's exit criterion for Phase 3 is that
 * **CI fails on a deliberately broken content file**. Asserting that by breaking a real
 * file during a test run would leave the repository in a broken state if the run were
 * interrupted. Instead, `tests/fixtures/broken-content/` holds permanently-broken
 * content and a test runs *this* function over it in a subprocess, so the proof goes
 * through the identical code path CI uses, and nothing is ever mutated.
 */
import { analyseCoverage } from "./coverage";
import { loadContent, type RawContentInput } from "./registry";

const RED = "\u001b[31m";
const YELLOW = "\u001b[33m";
const GREEN = "\u001b[32m";
const DIM = "\u001b[2m";
const RESET = "\u001b[0m";

/** Returns the process exit code: 0 for valid content, 1 for anything that must block. */
export function runValidation(raw?: RawContentInput): number {
  const result = loadContent(raw);

  if (!result.ok) {
    console.error(`${RED}✗ content is invalid — ${result.issues.length} problem(s)${RESET}\n`);
    for (const issue of result.issues) {
      console.error(`  ${RED}✗${RESET} ${issue.where}`);
      console.error(`    ${issue.message}`);
    }
    console.error("");
    return 1;
  }

  const { content } = result;
  const report = analyseCoverage(content);

  for (const warning of report.warnings) {
    console.warn(`  ${YELLOW}!${RESET} ${warning}`);
  }
  for (const fault of report.unassessedFaults) {
    console.warn(
      `  ${YELLOW}!${RESET} practical ${fault.practicalId} › fault ${fault.faultId}: no question assesses it`,
    );
  }
  if (report.warnings.length > 0 || report.unassessedFaults.length > 0) console.warn("");

  if (report.errors.length > 0) {
    console.error(
      `${RED}✗ coverage gates failed — ${report.errors.length} problem(s)${RESET}\n`,
    );
    for (const error of report.errors) console.error(`  ${RED}✗${RESET} ${error}`);
    console.error("");
    return 1;
  }

  const counts = [
    `${content.subTopics.size} sub-topics`,
    `${content.specPoints.size} spec points`,
    `${content.lessons.length} lessons`,
    `${content.notes.reduce((n, page) => n + page.sections.length, 0)} note sections`,
    `${content.questions.length} questions`,
    `${content.practicals.length} practicals`,
    `${content.blurtPrompts.length} blurt prompts`,
  ].join(" · ");

  console.log(`${GREEN}✓ content valid${RESET}  ${DIM}${counts}${RESET}`);
  const warningCount = report.warnings.length + report.unassessedFaults.length;
  if (warningCount > 0) {
    console.log(
      `${DIM}  ${warningCount} warning(s) above — declared gaps, not failures${RESET}`,
    );
  }
  return 0;
}
