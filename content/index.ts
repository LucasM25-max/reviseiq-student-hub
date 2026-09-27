/**
 * The content registry — the single entry point to everything in /content.
 *
 * Every consumer (the validator, the coverage report, the seeder, the app) reads this
 * module and nothing else, so adding a sub-topic means registering it here once.
 *
 * Nothing in this file is validated on import. Parsing happens in
 * src/lib/content/registry.ts, which is what callers should use.
 */
import { biologyTaxonomy } from "./biology/taxonomy";
import { blurtPrompts as bio4112Blurt } from "./biology/4.1.1.2/blurt";
import { lesson1 as bio4112Lesson1 } from "./biology/4.1.1.2/lessons/01-inside-animal-and-plant-cells";
import { lesson2 as bio4112Lesson2 } from "./biology/4.1.1.2/lessons/02-functions-and-size";
import { lesson3 as bio4112Lesson3 } from "./biology/4.1.1.2/lessons/03-required-practical-microscopy";
import { notes as bio4112Notes } from "./biology/4.1.1.2/notes";
import { questions as bio4112Questions } from "./biology/4.1.1.2/questions";
import { rp1Microscopy } from "./biology/practicals/rp-1-microscopy";

export const rawContent = {
  taxonomies: [biologyTaxonomy],
  practicals: [rp1Microscopy],
  lessons: [bio4112Lesson1, bio4112Lesson2, bio4112Lesson3],
  notes: [bio4112Notes],
  questions: [...bio4112Questions],
  blurtPrompts: [...bio4112Blurt],
};

export type RawContent = typeof rawContent;
