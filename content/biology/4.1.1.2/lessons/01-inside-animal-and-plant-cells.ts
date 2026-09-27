/**
 * Lesson 1 — Inside animal and plant cells.
 *
 * Block plan from docs/plan/slices/biology-4.1.1.2-animal-and-plant-cells.md §3.
 * Covers bio-4112-animal and bio-4112-plant.
 */
import type { LessonInput } from "@/lib/content/schema";

export const lesson1: LessonInput = {
  id: "bio-4112-l1",
  subTopicId: "aqa-biology-4.1.1",
  slug: "inside-animal-and-plant-cells",
  title: "Inside animal and plant cells",
  summary:
    "The parts that almost every animal cell has, the three things plant and algal cells add, and the two words in the specification that decide marks: often and permanent.",
  order: 0,
  estMinutes: 20,
  tier: "BOTH",
  blocks: [
    {
      type: "prose",
      recap: true,
      priorStage: "KS3",
      specPoints: [],
      body: 'You have met cells before. Every living thing is made of them, and the ones you looked at in Key Stage 3 were probably onion cells under a microscope.\n\nWhat you need now is more precise. At GCSE you are expected to name a specific list of parts, say what each one does, and know exactly which of them are found in which kind of cell. "A plant cell has more stuff in it" will not earn a mark. This lesson builds that list.',
    },
    {
      type: "widget",
      widgetId: "label-the-diagram",
      specPoints: ["bio-4112-animal"],
      config: {
        diagramId: "bio-animal-cell",
        mode: "recall-first",
        prompt: "Before you read on: label as many parts of this animal cell as you can.",
      },
    },
    {
      type: "prose",
      specPoints: ["bio-4112-animal"],
      body: "**Most animal cells have five parts you need to know.** The specification words it that way — *most* animal cells — because there are exceptions, and red blood cells are the famous one: they lose their nucleus as they mature.\n\nThe five are the **nucleus**, the **cytoplasm**, the **cell membrane**, the **mitochondria** and the **ribosomes**.\n\nTwo of those are easy to overlook. Ribosomes are on the list even though they are far too small to see with a light microscope, and mitochondria are on the list for *animal* cells even though people often associate them with plants. Both appear in exam questions for exactly that reason.",
    },
    {
      type: "definition",
      specPoints: ["bio-4112-animal"],
      term: "Nucleus",
      body: "Contains the genetic material (DNA) as chromosomes, and controls the activities of the cell.",
    },
    {
      type: "definition",
      specPoints: ["bio-4112-animal"],
      term: "Cytoplasm",
      body: "A jelly-like liquid where most of the chemical reactions of the cell take place. The other structures are suspended in it.",
    },
    {
      type: "definition",
      specPoints: ["bio-4112-animal"],
      term: "Cell membrane",
      body: "Holds the cell together and controls what substances enter and leave it.",
    },
    {
      type: "definition",
      specPoints: ["bio-4112-animal"],
      term: "Mitochondria",
      body: "The site of aerobic respiration, the reaction that transfers the energy a cell needs to work. One of them on its own is a mitochondri**on**.",
    },
    {
      type: "definition",
      specPoints: ["bio-4112-animal"],
      term: "Ribosomes",
      body: "The site of protein synthesis — where proteins are made. Far too small to see under a light microscope, but still on the list.",
    },
    {
      type: "check",
      specPoints: ["bio-4112-animal"],
      prompt: "Which of these is **not** found in most animal cells?",
      options: [
        { key: "A", text: "Mitochondria" },
        { key: "B", text: "Ribosomes" },
        { key: "C", text: "Chloroplasts" },
        { key: "D", text: "Cytoplasm" },
      ],
      correctKey: "C",
      explanation:
        "Chloroplasts are the site of photosynthesis, and animals do not photosynthesise. The other three are all on the list for most animal cells — including ribosomes, which are on the list despite being invisible under a light microscope.",
    },
    {
      type: "diagram",
      specPoints: ["bio-4112-plant"],
      diagramId: "bio-plant-cell",
      labels: "all",
      caption:
        "A typical plant cell. Everything an animal cell has, plus a cell wall, a permanent vacuole and chloroplasts.",
    },
    {
      type: "prose",
      specPoints: ["bio-4112-plant"],
      body: "A plant cell has all five of the parts you have just met, and then some more.\n\n**Plant and algal cells also have a cell wall made of cellulose, which strengthens the cell.** Note who that applies to: plants *and* algae. Algae are not plants, and the specification names them separately for that reason.\n\n**Plant cells often have chloroplasts and a permanent vacuole filled with cell sap.** Chloroplasts contain the green pigment chlorophyll and are where photosynthesis happens. The permanent vacuole is a large sac of cell sap that helps keep the cell firm.",
    },
    {
      type: "keyIdea",
      specPoints: ["bio-4112-plant"],
      body: "Read those two sentences again and notice the words doing the work.\n\n- The cell wall belongs to plant **and algal** cells — not plants alone.\n- Plant cells **often** have chloroplasts. Not always.\n- It is the **permanent** vacuole that is a plant feature. Animal cells can have small, temporary vacuoles.\n\nThese hedges are not padding. Each one is the difference between a right answer and a wrong one, and each one is examined.",
    },
    {
      type: "misconception",
      specPoints: ["bio-4112-plant"],
      claim: "Every plant cell has chloroplasts.",
      correction:
        'Only cells that receive light have them. A root hair cell is a plant cell, and it is underground — chloroplasts would be useless there, so it has none. This is why the specification says plant cells *often* have chloroplasts, and why writing "all plant cells have chloroplasts" is marked wrong.',
    },
    {
      type: "misconception",
      specPoints: ["bio-4112-plant"],
      claim: "The cell wall controls what enters and leaves the cell.",
      correction:
        "The cell **membrane** does that, and plant cells have one of those too, just inside the wall. The wall is made of cellulose and its job is strength — it stops the cell bursting when it fills with water. This swap is one of the most reliable ways to lose a mark in this topic, and it is rejected even when it appears as a throwaway clause in an otherwise good answer.",
    },
    {
      type: "widget",
      widgetId: "comparison-table",
      specPoints: ["bio-4112-animal", "bio-4112-plant"],
      config: {
        mode: "fill-in",
        instruction:
          "Tick every box that applies. The last three rows are about processes, not parts — they are where this table is usually lost.",
        rowHeading: "Found in / carried out by",
        columns: ["Animal cell", "Plant cell"],
        rows: [
          { label: "Nucleus", answers: [true, true] },
          { label: "Cytoplasm", answers: [true, true] },
          { label: "Cell membrane", answers: [true, true] },
          { label: "Mitochondria", answers: [true, true] },
          { label: "Ribosomes", answers: [true, true] },
          {
            label: "Cell wall",
            answers: [false, true],
            note: "Made of cellulose, and shared with algal cells — which are not plants.",
          },
          {
            label: "Chloroplasts",
            answers: [false, true],
            note: "Plant cells *often* have them, not always: a root hair cell is underground and has none.",
          },
          {
            label: "Permanent vacuole",
            answers: [false, true],
            note: "An animal cell can have a small, temporary vacuole. It is the word *permanent* that makes this a plant feature.",
          },
          {
            label: "Carries out aerobic respiration",
            answers: [true, true],
            note: "Plants respire too, all the time. Assuming they only photosynthesise is one of the most common errors in this topic.",
          },
          { label: "Carries out photosynthesis", answers: [false, true] },
          {
            label: "Carries out protein synthesis",
            answers: [true, true],
            note: "Both have ribosomes, so both make proteins.",
          },
        ],
      },
    },
    {
      type: "check",
      specPoints: ["bio-4112-plant"],
      prompt:
        "Which pair of structures is found in a plant cell but **not** in an animal cell?",
      options: [
        { key: "A", text: "Cell wall and cell membrane" },
        { key: "B", text: "Cell wall and permanent vacuole" },
        { key: "C", text: "Mitochondria and ribosomes" },
        { key: "D", text: "Nucleus and chloroplasts" },
      ],
      correctKey: "B",
      explanation:
        "Animal cells have a cell membrane, mitochondria, ribosomes and a nucleus, so A, C and D each contain something both cell types share. Only the cell wall and the permanent vacuole are plant features — and note that the last three rows of the comparison table you just filled in are about *processes*, which is a different question again.",
    },
    {
      type: "summary",
      specPoints: [],
      body: "**Most animal cells:** nucleus · cytoplasm · cell membrane · mitochondria · ribosomes.\n\n**Plant and algal cells add:** a cellulose cell wall, which strengthens the cell.\n\n**Plant cells often add:** chloroplasts and a permanent vacuole filled with cell sap.\n\nThe three words that decide marks are *often*, *permanent*, and *algal*.\n\nNext: what each of these parts is actually for, and how to judge how big they are.",
    },
  ],
};
