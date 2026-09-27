/**
 * Diagram registry (D18 — hand-built SVG, no stock images).
 *
 * This file is **data only**, deliberately free of JSX, so the validator and the seeder
 * can check every `diagramId` and `diagramLetters` reference without pulling React into
 * a Node script. The components that draw these live in
 * src/components/content/diagrams/ and are wired up in src/components/content/diagram.tsx.
 *
 * `structures` is the contract between a diagram and the content that points at it:
 * lesson blocks name labels to show, and questions letter them A, B, C… for
 * "name the structure labelled B" questions. Renaming a key is a breaking change and
 * `npm run content:validate` will say so.
 */

export type DiagramStructure = {
  /** Stable key referenced from content. Never rename — add instead. */
  key: string;
  /** What the label reads on the drawing. */
  label: string;
};

export type DiagramMeta = {
  id: string;
  title: string;
  /** Short description used as the accessible name when the diagram is decorative-free. */
  description: string;
  viewBox: string;
  structures: DiagramStructure[];
};

export const DIAGRAMS: DiagramMeta[] = [
  {
    id: "bio-animal-cell",
    title: "Animal cell",
    description:
      "A rounded animal cell showing the cell membrane, cytoplasm, nucleus, mitochondria and ribosomes.",
    viewBox: "0 0 620 340",
    structures: [
      { key: "cell-membrane", label: "Cell membrane" },
      { key: "cytoplasm", label: "Cytoplasm" },
      { key: "nucleus", label: "Nucleus" },
      { key: "mitochondrion", label: "Mitochondria" },
      { key: "ribosome", label: "Ribosomes" },
    ],
  },
  {
    id: "bio-plant-cell",
    title: "Plant cell",
    description:
      "A rectangular plant cell showing the cellulose cell wall, cell membrane, cytoplasm, nucleus, mitochondria, ribosomes, chloroplasts and the permanent vacuole.",
    viewBox: "0 0 620 340",
    structures: [
      { key: "cell-wall", label: "Cell wall" },
      { key: "cell-membrane", label: "Cell membrane" },
      { key: "cytoplasm", label: "Cytoplasm" },
      { key: "nucleus", label: "Nucleus" },
      { key: "mitochondrion", label: "Mitochondria" },
      { key: "ribosome", label: "Ribosomes" },
      { key: "chloroplast", label: "Chloroplasts" },
      { key: "permanent-vacuole", label: "Permanent vacuole" },
    ],
  },
  {
    id: "bio-cell-scale-strip",
    title: "Scale of a cell and its contents",
    description:
      "A logarithmic scale strip from 10 nanometres to 100 micrometres, marking a ribosome, a mitochondrion, a chloroplast, a nucleus and a whole cell.",
    viewBox: "0 0 520 170",
    structures: [
      { key: "ribosome", label: "Ribosome — about 20 nm" },
      { key: "mitochondrion", label: "Mitochondrion — 1–2 µm" },
      { key: "chloroplast", label: "Chloroplast — 3–10 µm" },
      { key: "nucleus", label: "Nucleus — 5–10 µm" },
      { key: "cell", label: "Plant cell — 10–100 µm" },
    ],
  },
];

const byId = new Map(DIAGRAMS.map((diagram) => [diagram.id, diagram]));

export const getDiagram = (id: string): DiagramMeta | undefined => byId.get(id);

export const diagramIds = (): string[] => DIAGRAMS.map((diagram) => diagram.id);

/** Resolves a structure key on a diagram, or undefined if the diagram does not have it. */
export const getStructure = (
  diagramId: string,
  structureKey: string,
): DiagramStructure | undefined =>
  byId.get(diagramId)?.structures.find((structure) => structure.key === structureKey);
