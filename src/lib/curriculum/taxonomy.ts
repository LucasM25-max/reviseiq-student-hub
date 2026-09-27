/**
 * Curriculum taxonomy — AQA GCSE separate sciences (D6).
 *
 * This is *structure*, not content: specification codes, topic titles and paper
 * assignments, which is what the onboarding RAG screen and (later) the Today scheduler
 * need in order to exist. Sub-topics, spec points, lessons, notes and questions arrive
 * in Phase 3 from source material, per docs/plan/04-content-pipeline.md.
 *
 * Verified against the AQA specifications:
 *   Biology   8461 — Paper 1 topics 1–4,  Paper 2 topics 5–7
 *   Chemistry 8462 — Paper 1 topics 1–5,  Paper 2 topics 6–10
 *   Physics   8463 — Paper 1 topics 1–4,  Paper 2 topics 5–8
 * Each paper: 1h45, 100 marks, 50% of the qualification, Foundation or Higher tier.
 */

export type SubjectCodeValue = "BIOLOGY" | "CHEMISTRY" | "PHYSICS";

export type TopicSeed = {
  /** AQA specification code, e.g. "4.1". */
  code: string;
  number: number;
  title: string;
  /** Which written paper assesses this topic. */
  paper: 1 | 2;
};

export type SubjectSeed = {
  id: string;
  code: SubjectCodeValue;
  qualCode: string;
  name: string;
  /** Design-token key for the subject accent colour. */
  accent: "biology" | "chemistry" | "physics";
  order: number;
  topics: TopicSeed[];
};

export const SUBJECTS: SubjectSeed[] = [
  {
    id: "aqa-biology",
    code: "BIOLOGY",
    qualCode: "8461",
    name: "Biology",
    accent: "biology",
    order: 1,
    topics: [
      { code: "4.1", number: 1, title: "Cell biology", paper: 1 },
      { code: "4.2", number: 2, title: "Organisation", paper: 1 },
      { code: "4.3", number: 3, title: "Infection and response", paper: 1 },
      { code: "4.4", number: 4, title: "Bioenergetics", paper: 1 },
      { code: "4.5", number: 5, title: "Homeostasis and response", paper: 2 },
      { code: "4.6", number: 6, title: "Inheritance, variation and evolution", paper: 2 },
      { code: "4.7", number: 7, title: "Ecology", paper: 2 },
    ],
  },
  {
    id: "aqa-chemistry",
    code: "CHEMISTRY",
    qualCode: "8462",
    name: "Chemistry",
    accent: "chemistry",
    order: 2,
    topics: [
      { code: "4.1", number: 1, title: "Atomic structure and the periodic table", paper: 1 },
      {
        code: "4.2",
        number: 2,
        title: "Bonding, structure, and the properties of matter",
        paper: 1,
      },
      { code: "4.3", number: 3, title: "Quantitative chemistry", paper: 1 },
      { code: "4.4", number: 4, title: "Chemical changes", paper: 1 },
      { code: "4.5", number: 5, title: "Energy changes", paper: 1 },
      { code: "4.6", number: 6, title: "The rate and extent of chemical change", paper: 2 },
      { code: "4.7", number: 7, title: "Organic chemistry", paper: 2 },
      { code: "4.8", number: 8, title: "Chemical analysis", paper: 2 },
      { code: "4.9", number: 9, title: "Chemistry of the atmosphere", paper: 2 },
      { code: "4.10", number: 10, title: "Using resources", paper: 2 },
    ],
  },
  {
    id: "aqa-physics",
    code: "PHYSICS",
    qualCode: "8463",
    name: "Physics",
    accent: "physics",
    order: 3,
    topics: [
      { code: "4.1", number: 1, title: "Energy", paper: 1 },
      { code: "4.2", number: 2, title: "Electricity", paper: 1 },
      { code: "4.3", number: 3, title: "Particle model of matter", paper: 1 },
      { code: "4.4", number: 4, title: "Atomic structure", paper: 1 },
      { code: "4.5", number: 5, title: "Forces", paper: 2 },
      { code: "4.6", number: 6, title: "Waves", paper: 2 },
      { code: "4.7", number: 7, title: "Magnetism and electromagnetism", paper: 2 },
      { code: "4.8", number: 8, title: "Space physics", paper: 2 },
    ],
  },
];

/** Stable topic row id, e.g. "aqa-biology-4.1". */
export const topicId = (subjectId: string, code: string) => `${subjectId}-${code}`;

/** Every exam paper: 1h45, 100 marks. Used by the exam-date step and later by mocks. */
export const PAPERS = [1, 2] as const;
