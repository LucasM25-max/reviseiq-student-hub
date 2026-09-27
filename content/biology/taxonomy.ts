/**
 * Biology sub-topic taxonomy.
 *
 * Authored before any prose, because spec point codes are the join key for the whole
 * application (docs/plan/03-data-model.md). Teaching order follows the AQA scheme of
 * work, not the specification's numbering (D44) — so 4.1.1.2 is taught first and
 * 4.1.1.1 is not yet present.
 *
 * Sub-topic ids extend the seeded topic id, so `aqa-biology-4.1` owns `aqa-biology-4.1.1`.
 */
import type { TaxonomyInput } from "@/lib/content/schema";

export const biologyTaxonomy: TaxonomyInput = {
  subjectId: "aqa-biology",
  topicCode: "4.1",
  subTopics: [
    {
      id: "aqa-biology-4.1.1",
      code: "4.1.1",
      title: "Cell structure",
      order: 0,
      specPoints: [
        {
          id: "bio-4112-animal",
          code: "4.1.1.2",
          statement:
            "Most animal cells have the following parts: a nucleus, cytoplasm, a cell membrane, mitochondria and ribosomes.",
          tier: "BOTH",
          mathsSkills: [],
          wsSkills: ["WS 1.2"],
          practicalIds: ["bio-rp-1"],
          coverage: "FULL",
          blockedBy: [],
        },
        {
          id: "bio-4112-plant",
          code: "4.1.1.2",
          statement:
            "Plant and algal cells also have a cell wall made of cellulose, which strengthens the cell. Plant cells often have chloroplasts and a permanent vacuole filled with cell sap.",
          tier: "BOTH",
          mathsSkills: [],
          wsSkills: ["WS 1.2"],
          practicalIds: ["bio-rp-1"],
          coverage: "FULL",
          blockedBy: [],
        },
        {
          id: "bio-4112-func",
          code: "4.1.1.2",
          statement:
            "Students should be able to explain how the main sub-cellular structures, including the nucleus, cell membranes, mitochondria, chloroplasts in plant cells and plasmids in bacterial cells, are related to their functions.",
          tier: "BOTH",
          mathsSkills: [],
          wsSkills: ["WS 1.2"],
          practicalIds: [],
          // Plasmids require bacteria, which are introduced in 4.1.1.1. Teaching them here
          // would mean explaining prokaryotes before the lesson that exists to do that.
          coverage: "PARTIAL",
          blockedBy: ["4.1.1.1 — plasmids cannot be taught before bacterial cells exist"],
        },
        {
          id: "bio-4112-est",
          code: "4.1.1.2",
          statement:
            "Students should be able to use estimations and explain when they should be used to judge the relative size or area of sub-cellular structures.",
          tier: "BOTH",
          mathsSkills: ["MS 1d", "MS 3a"],
          wsSkills: ["WS 4.4", "WS 4.5"],
          practicalIds: ["bio-rp-1"],
          coverage: "FULL",
          blockedBy: [],
        },
        {
          // AQA prints the required practical as its own assessable requirement directly
          // after 4.1.1.2, so it is modelled as a spec point. It shares its id with the
          // practical definition in ./practicals/rp-1-microscopy.ts deliberately: one
          // requirement, reported under one name.
          id: "bio-rp-1",
          code: "4.1.1.2",
          statement:
            "Required practical activity 1: use a light microscope to observe, draw and label a selection of plant and animal cells. A magnification scale must be included.",
          tier: "BOTH",
          mathsSkills: [],
          wsSkills: ["WS 1.2", "WS 4.4", "WS 4.5"],
          practicalIds: ["bio-rp-1"],
          // D48 — onion epidermal cells only; the requirement names animal cells too.
          coverage: "PARTIAL",
          blockedBy: ["Animal cells are deliberately out of scope for the simulation (D48)"],
        },
      ],
    },
  ],
};
