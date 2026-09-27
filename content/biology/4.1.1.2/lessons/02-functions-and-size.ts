/**
 * Lesson 2 — Why each part is there, and how big it is.
 *
 * Block plan from docs/plan/slices/biology-4.1.1.2-animal-and-plant-cells.md §3.
 * Covers bio-4112-func (minus plasmids, deferred to 4.1.1.1) and bio-4112-est.
 *
 * This is the AO2 lesson: the specification verb is *explain*, and naming a part is
 * worth one mark out of several.
 */
import type { LessonInput } from "@/lib/content/schema";

export const lesson2: LessonInput = {
  id: "bio-4112-l2",
  subTopicId: "aqa-biology-4.1.1",
  slug: "functions-and-size",
  title: "Why each part is there, and how big it is",
  summary:
    "Linking each sub-cellular structure to its function in the language mark schemes accept, and estimating the size and area of things far too small to measure directly.",
  order: 1,
  estMinutes: 20,
  tier: "BOTH",
  blocks: [
    {
      type: "keyIdea",
      specPoints: ["bio-4112-func"],
      body: 'The specification does not ask you to *list* the sub-cellular structures. It asks you to **explain how they are related to their functions**.\n\nThat difference is worth several marks. "Mitochondria" on its own answers a one-mark naming question. A three-mark *explain* question wants the structure, what it does, and why that matters to this particular cell. Most lost marks in this topic are answers that stop after the first of those three.',
    },
    {
      type: "prose",
      specPoints: ["bio-4112-func"],
      body: "### The nucleus\n\nThe nucleus contains the cell's genetic material, DNA, arranged as chromosomes. Those genes carry the instructions for making proteins, and because the proteins a cell makes determine what the cell can do, the nucleus **controls the activities of the cell**.\n\nBoth halves of that are creditworthy: *contains the genetic material* and *controls the activities of the cell*. If a question is worth two marks, it usually wants both.",
    },
    {
      type: "prose",
      specPoints: ["bio-4112-func"],
      body: "### The cell membrane\n\nEvery cell is surrounded by a cell membrane. It holds the cell together, and it **controls which substances enter and leave the cell**.\n\nThat control is the point. The membrane lets in the things the cell needs — oxygen, glucose — and lets out the things it must get rid of, such as carbon dioxide, while keeping everything else where it belongs. A cell that could not control its own boundary could not keep its internal conditions steady.",
    },
    {
      type: "prose",
      specPoints: ["bio-4112-func"],
      body: "### Mitochondria\n\nMitochondria are the **site of aerobic respiration**. Aerobic respiration is the reaction that transfers energy from glucose so the cell can use it — for movement, for building new molecules, for keeping warm.\n\nSo the number of mitochondria in a cell tells you something about how much energy that cell needs. A muscle cell, which contracts repeatedly, is packed with them. A sperm cell has them concentrated in its middle section, right where the tail needs the energy.",
    },
    {
      type: "misconception",
      specPoints: ["bio-4112-func"],
      claim: "Mitochondria are the powerhouse of the cell.",
      correction:
        'You will hear this everywhere, and it scores nothing. It is a metaphor, not a function — it does not say what happens there. Nor does "mitochondria make energy" or "produce energy": energy cannot be made, only transferred, and that phrasing is rejected. The creditworthy answer is **the site of aerobic respiration**, and if there is a second mark available, that respiration **transfers energy for the cell to use**.',
    },
    {
      type: "prose",
      specPoints: ["bio-4112-func"],
      body: "### Chloroplasts\n\nChloroplasts are found in the plant cells that receive light, and they are the **site of photosynthesis**.\n\nThey contain a green pigment called **chlorophyll**, which absorbs the light energy that photosynthesis needs. That absorbed light is what drives the reaction that makes glucose from carbon dioxide and water.\n\nSo a palisade cell near the top surface of a leaf is full of chloroplasts, and a root hair cell has none at all — because there is no light underground for chlorophyll to absorb.",
    },
    {
      type: "misconception",
      specPoints: ["bio-4112-func"],
      claim: "Chlorophyll and chloroplast are two words for the same thing.",
      correction:
        "They are not, and examiners watch for it. The **chloroplast** is the structure — the green disc inside the cell. **Chlorophyll** is the pigment held inside that structure, and it is the chlorophyll that actually absorbs the light. Photosynthesis happens *in the chloroplast*, not *in the chlorophyll*, so swapping the words can cost the mark.",
    },
    {
      type: "widget",
      widgetId: "card-sort",
      specPoints: ["bio-4112-func"],
      config: {
        instruction: "Match each structure to its function.",
        pairs: [
          {
            left: "Nucleus",
            right: "Contains the genetic material and controls the activities of the cell",
          },
          {
            left: "Cytoplasm",
            right: "Where most of the chemical reactions of the cell take place",
          },
          { left: "Cell membrane", right: "Controls what enters and leaves the cell" },
          { left: "Mitochondria", right: "The site of aerobic respiration" },
          { left: "Ribosomes", right: "The site of protein synthesis" },
          { left: "Chloroplasts", right: "The site of photosynthesis; contain chlorophyll" },
          {
            left: "Permanent vacuole",
            right: "Filled with cell sap; helps keep the cell firm",
          },
          { left: "Cell wall", right: "Made of cellulose; strengthens the cell" },
        ],
      },
    },
    {
      type: "check",
      specPoints: ["bio-4112-func"],
      prompt:
        "A muscle cell contains far more mitochondria than a skin cell does. Which answer would earn both marks on *explain why*?",
      options: [
        { key: "A", text: "Because muscle cells are bigger, so there is more room." },
        { key: "B", text: "Because mitochondria are the powerhouse of the muscle cell." },
        {
          key: "C",
          text: "Because muscle cells contract and so need a lot of energy, and mitochondria are the site of aerobic respiration, which transfers that energy.",
        },
        { key: "D", text: "Because muscle cells need to make more protein than skin cells." },
      ],
      correctKey: "C",
      explanation:
        "C names the demand (contraction needs energy) and links it to the structure (mitochondria are the site of aerobic respiration). B uses the metaphor and scores nothing. D describes ribosomes, not mitochondria. A is not a biological explanation.",
    },
    {
      type: "prose",
      specPoints: ["bio-4112-est"],
      body: "### When an estimate is the right tool\n\nYou will often be asked how big something is when nobody has handed you a ruler that fits. A nucleus cannot be measured with a millimetre scale, and a photograph of a cell rarely comes with every dimension marked.\n\nAn **estimate** is the right tool when:\n\n- you need a size quickly and an approximate value is good enough to answer the question;\n- you have one known length to compare against, such as a scale bar or a stated cell size;\n- you are checking whether an answer is sensible — is this nucleus about a fifth of the cell, or about the same size as it?\n\nIt is the **wrong** tool when a precise value matters: calibrating a graticule, or comparing two treatments in an experiment where the difference between them is small. There you measure.",
    },
    {
      type: "widget",
      widgetId: "scale-explorer",
      specPoints: ["bio-4112-est"],
      config: {
        mode: "nested",
        diagramId: "bio-cell-scale-strip",
        levels: [
          { label: "Cell", size: "10–100 µm" },
          { label: "Nucleus", size: "5–10 µm" },
          { label: "Chromosome", size: "about 1 µm wide" },
          { label: "Gene", size: "a short section of the DNA in a chromosome" },
        ],
      },
    },
    {
      type: "example",
      specPoints: ["bio-4112-est"],
      title: "Estimating the area of a nucleus",
      steps: [
        "A plant cell in a photograph is roughly rectangular. You are told it is 30 µm long and 15 µm wide.",
        "Find the area of the whole cell: 30 × 15 = 450 µm². Note the unit — an area is in µm², not µm.",
        "Now judge how many nuclei of the size shown would fit inside that outline. Suppose about 18 of them would.",
        "Divide: 450 ÷ 18 = 25 µm² for one nucleus.",
        "Check it is sensible. A nucleus 5 µm across would have an area of roughly 5 × 5 = 25 µm². It agrees, so the estimate stands.",
      ],
    },
    {
      type: "prose",
      specPoints: ["bio-4112-est"],
      body: "### Saying how much bigger\n\nWhen you compare sizes you can use symbols instead of words, and the specification expects you to read them:\n\n| Symbol | Means |\n| --- | --- |\n| $=$ | is equal to |\n| $<$ | is less than |\n| $\\ll$ | is much less than |\n| $>$ | is greater than |\n| $\\gg$ | is much greater than |\n| $\\propto$ | is proportional to |\n| $\\sim$ | is roughly |\n\nSo a ribosome at about 20 nm against a plant cell at up to 100 µm is written $\\text{ribosome} \\ll \\text{cell}$ — and the gap really is that big. 100 µm is 100 000 nm, which is five thousand times the width of a ribosome.\n\nSizes worth carrying in your head: an **animal cell** is about 10–30 µm across, a **plant cell** about 10–100 µm, a **nucleus** about 5–10 µm, a **mitochondrion** 1–2 µm, a **chloroplast** 3–10 µm, and a **ribosome** about 20 nm.",
    },
    {
      type: "summary",
      specPoints: [],
      body: '**Structure to function, in creditworthy language:**\n\n- Nucleus — contains the genetic material; controls the activities of the cell.\n- Cytoplasm — where most of the chemical reactions happen.\n- Cell membrane — controls what enters and leaves.\n- Mitochondria — the site of aerobic respiration. Never "powerhouse".\n- Ribosomes — the site of protein synthesis.\n- Chloroplasts — the site of photosynthesis; contain chlorophyll, which absorbs light.\n- Permanent vacuole — cell sap; keeps the cell firm.\n- Cell wall — cellulose; strengthens the cell.\n\n**Estimating:** compare against one known length, divide, and check the answer is sensible. Areas are in µm².\n\nNext: seeing all of this yourself, down a microscope.',
    },
  ],
};
