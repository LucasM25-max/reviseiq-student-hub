/**
 * `npm run content:report`
 *
 * Prints the honest per-sub-topic coverage table: what exists, what is tested, and what
 * is knowingly missing and why. Does not fail on gaps — `content:validate` is the gate.
 * This is the thing you read before deciding what to author next.
 */
import { analyseCoverage } from "../src/lib/content/coverage";
import { loadContent } from "../src/lib/content/registry";

const BOLD = "\u001b[1m";
const DIM = "\u001b[2m";
const RED = "\u001b[31m";
const GREEN = "\u001b[32m";
const YELLOW = "\u001b[33m";
const RESET = "\u001b[0m";

/** Pads by printable width, ignoring ANSI colour codes. */
function pad(value: string, width: number): string {
  const printable = value.replace(/\u001b\[[0-9;]*m/g, "").length;
  return value + " ".repeat(Math.max(0, width - printable));
}

function table(headers: string[], rows: string[][]): void {
  const widths = headers.map((header, index) =>
    Math.max(
      header.length,
      ...rows.map((row) => (row[index] ?? "").replace(/\u001b\[[0-9;]*m/g, "").length),
    ),
  );
  console.log(
    `  ${BOLD}${headers.map((header, index) => pad(header, widths[index]!)).join("  ")}${RESET}`,
  );
  console.log(`  ${DIM}${widths.map((width) => "─".repeat(width)).join("  ")}${RESET}`);
  for (const row of rows) {
    console.log(`  ${row.map((cell, index) => pad(cell ?? "", widths[index]!)).join("  ")}`);
  }
}

function main(): number {
  const result = loadContent();
  if (!result.ok) {
    console.error(
      `${RED}✗ content is invalid — run \`npm run content:validate\` for detail${RESET}`,
    );
    return 1;
  }

  const { content } = result;
  const report = analyseCoverage(content);

  console.log(`\n${BOLD}ReviseIQ content coverage${RESET}\n`);

  for (const subTopic of report.subTopics) {
    console.log(
      `${BOLD}${subTopic.code} ${subTopic.title}${RESET}  ${DIM}${subTopic.subTopicId}${RESET}`,
    );
    console.log(
      `${DIM}  ${subTopic.lessonCount} lessons · ${subTopic.noteSectionCount} note sections · ` +
        `${subTopic.blurtCount} blurt prompts · ${subTopic.questionCount} questions (${subTopic.markTotal} marks)${RESET}`,
    );
    console.log(
      `${DIM}  AO1 ${subTopic.aoShare.AO1}% · AO2 ${subTopic.aoShare.AO2}% · AO3 ${subTopic.aoShare.AO3}%  ` +
        `│  practical ${subTopic.practicalMarkShare}% of marks  │  types: ${subTopic.questionTypes.join(", ")}${RESET}\n`,
    );

    table(
      ["spec point", "code", "teach", "notes", "Qs", "marks", "status"],
      subTopic.specPoints.map((coverage) => {
        const status =
          coverage.status === "covered"
            ? `${GREEN}covered${RESET}`
            : coverage.status === "partial"
              ? `${YELLOW}partial${RESET}`
              : `${RED}GAP${RESET}`;
        return [
          coverage.specPoint.id,
          coverage.specPoint.code,
          String(coverage.teachingBlocks),
          String(coverage.noteSections),
          String(coverage.questions),
          String(coverage.marks),
          status,
        ];
      }),
    );

    const partial = subTopic.specPoints.filter((coverage) => coverage.status === "partial");
    if (partial.length > 0) {
      console.log("");
      for (const coverage of partial) {
        console.log(
          `  ${YELLOW}partial${RESET} ${coverage.specPoint.id} — ${coverage.specPoint.blockedBy.join("; ")}`,
        );
      }
    }
    console.log("");
  }

  if (content.practicals.length > 0) {
    console.log(`${BOLD}Required practicals${RESET}\n`);
    table(
      ["practical", "faults", "assessed", "coverage"],
      content.practicals.map((practical) => {
        const assessed = practical.faults.filter(
          (fault) => fault.questionIds.length > 0,
        ).length;
        return [
          `${practical.id} — ${practical.title}`,
          String(practical.faults.length),
          `${assessed}/${practical.faults.length}`,
          practical.coverage === "FULL" ? `${GREEN}full${RESET}` : `${YELLOW}partial${RESET}`,
        ];
      }),
    );
    if (report.unassessedFaults.length > 0) {
      console.log("");
      for (const fault of report.unassessedFaults) {
        console.log(
          `  ${YELLOW}!${RESET} ${fault.practicalId} › ${fault.faultId} — in the simulation and the revision sheet, but no exam question yet`,
        );
      }
    }
    console.log("");
  }

  const gapCount = report.subTopics.reduce(
    (count, subTopic) =>
      count + subTopic.specPoints.filter((coverage) => coverage.status === "gap").length,
    0,
  );
  const partialCount = report.subTopics.reduce(
    (count, subTopic) =>
      count + subTopic.specPoints.filter((coverage) => coverage.status === "partial").length,
    0,
  );

  console.log(
    `${BOLD}Summary${RESET}  ${content.specPoints.size} spec points · ` +
      `${GREEN}${content.specPoints.size - gapCount - partialCount} covered${RESET} · ` +
      `${YELLOW}${partialCount} partial${RESET} · ` +
      `${gapCount > 0 ? RED : DIM}${gapCount} gaps${RESET}\n`,
  );

  if (report.errors.length > 0) {
    console.log(
      `${RED}${report.errors.length} gate failure(s) — \`npm run content:validate\` will fail${RESET}\n`,
    );
  }

  return 0;
}

process.exitCode = main();
