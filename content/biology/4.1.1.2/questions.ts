/**
 * Question bank — 4.1.1.2 Animal and plant cells, including Required practical 1.
 *
 * Blueprint: docs/plan/slices/biology-4.1.1.2-animal-and-plant-cells.md §7.
 * All questions are original (D5). AQA questions are never reproduced.
 *
 * The bank is checked by `npm run content:validate`, which enforces the blueprint
 * numerically: mark points must total the marks on offer, the AO split must sit within
 * ±5 percentage points of 40/40/20, practical marks must be at least 15% of the total,
 * and every spec point, diagram, practical and fault reference must resolve.
 *
 * Marking conventions specific to this content (slice §8):
 *   1. A comparison must compare — mark points are written as paired statements.
 *   2. Right + wrong = wrong. A correct statement contradicted by an incorrect one in
 *      the same answer negates the mark, as AQA does.
 *   3. Hedges are marked. "All plant cells have chloroplasts" is rejected.
 *   4. Cell wall is not cell membrane, wherever the swap appears.
 *   5. Vague function language ("powerhouse") earns nothing.
 *   6. Units and prefixes are marked.
 *   7. `modelAnswer` is never sent to the marker.
 */
import type { QuestionInput } from "@/lib/content/schema";

const SUBJECT = "aqa-biology";
const SUB_TOPIC = "aqa-biology-4.1.1";

export const questions: QuestionInput[] = [
  // -------------------------------------------------------------------------
  // Content — 12 questions, 31 marks
  // -------------------------------------------------------------------------
  {
    id: "bio-4112-q01",
    subjectId: SUBJECT,
    primarySubTopicId: SUB_TOPIC,
    type: "MCQ",
    tier: "BOTH",
    paper: 1,
    marks: 1,
    commandWord: "Tick one box",
    ao: "AO1",
    difficulty: 2,
    estSeconds: 60,
    stem: "Which statement about chloroplasts is correct?",
    options: [
      { key: "A", text: "All plant cells contain chloroplasts." },
      { key: "B", text: "Plant cells often contain chloroplasts." },
      { key: "C", text: "All animal cells contain chloroplasts." },
      { key: "D", text: "Chloroplasts are found inside the nucleus." },
    ],
    correctKey: "B",
    specPoints: [{ code: "bio-4112-plant", weight: 1 }],
    markScheme: {
      points: [
        {
          id: "mp1",
          text: "B — plant cells often contain chloroplasts",
          marks: 1,
          alternatives: [],
          reject: [],
        },
      ],
      guidance:
        "Distractor A is misconception 1: the specification says plant cells *often* have chloroplasts, and root hair cells have none.",
      modelAnswer:
        "B. The specification says plant cells *often* have chloroplasts, because cells that receive no light — such as root hair cells — do not have them.",
    },
  },
  {
    id: "bio-4112-q02",
    subjectId: SUBJECT,
    primarySubTopicId: SUB_TOPIC,
    type: "MCQ",
    tier: "BOTH",
    paper: 1,
    marks: 1,
    commandWord: "Tick one box",
    ao: "AO1",
    difficulty: 1,
    estSeconds: 45,
    stem: "Which sub-cellular structure is the site of aerobic respiration?",
    options: [
      { key: "A", text: "Chloroplast" },
      { key: "B", text: "Mitochondrion" },
      { key: "C", text: "Nucleus" },
      { key: "D", text: "Ribosome" },
    ],
    correctKey: "B",
    specPoints: [{ code: "bio-4112-func", weight: 1 }],
    markScheme: {
      points: [
        { id: "mp1", text: "B — mitochondrion", marks: 1, alternatives: [], reject: [] },
      ],
      modelAnswer: "B. Mitochondria are the site of aerobic respiration.",
    },
  },
  {
    id: "bio-4112-q03",
    subjectId: SUBJECT,
    primarySubTopicId: SUB_TOPIC,
    type: "SHORT",
    tier: "BOTH",
    paper: 1,
    marks: 3,
    commandWord: "Name",
    ao: "AO1",
    difficulty: 2,
    estSeconds: 150,
    stem: "**Figure 1** shows a plant cell.\n\nName the structures labelled **A**, **B** and **C**.",
    assets: {
      diagramId: "bio-plant-cell",
      diagramLetters: ["cell-wall", "permanent-vacuole", "chloroplast"],
      figureCaption: "Figure 1 — a plant cell",
    },
    specPoints: [
      { code: "bio-4112-animal", weight: 0.5 },
      { code: "bio-4112-plant", weight: 1 },
    ],
    markScheme: {
      points: [
        {
          id: "mp1",
          text: "A — cell wall",
          marks: 1,
          alternatives: ["cellulose cell wall"],
          reject: ["cell membrane", "wall of the cell membrane"],
        },
        {
          id: "mp2",
          text: "B — permanent vacuole",
          marks: 1,
          alternatives: ["vacuole"],
          reject: ["cell sap"],
        },
        {
          id: "mp3",
          text: "C — chloroplast",
          marks: 1,
          alternatives: [],
          reject: ["chlorophyll"],
        },
      ],
      guidance:
        "Reject 'chlorophyll' for C — that is the pigment inside the chloroplast, not the structure. Accept 'vacuole' alone for B.",
      modelAnswer: "A — cell wall. B — permanent vacuole. C — chloroplast.",
    },
  },
  {
    id: "bio-4112-q04",
    subjectId: SUBJECT,
    primarySubTopicId: SUB_TOPIC,
    type: "SHORT",
    tier: "BOTH",
    paper: 1,
    marks: 2,
    commandWord: "State",
    ao: "AO1",
    difficulty: 2,
    estSeconds: 120,
    stem: "State the function of the nucleus and the function of the cell membrane.",
    specPoints: [{ code: "bio-4112-func", weight: 1 }],
    markScheme: {
      points: [
        {
          id: "mp1",
          text: "Nucleus: controls the activities of the cell",
          marks: 1,
          alternatives: ["contains the genetic material / DNA / chromosomes"],
          reject: ["the brain of the cell", "controls the cell (unqualified)"],
        },
        {
          id: "mp2",
          text: "Cell membrane: controls what enters and leaves the cell",
          marks: 1,
          alternatives: ["controls the movement of substances into and out of the cell"],
          reject: ["holds the cell together (alone)", "protects the cell"],
        },
      ],
      guidance:
        "Either half of the nucleus answer scores mp1. For mp2 the idea of *control of movement in and out* is required; 'surrounds the cell' is not enough. If the answer also says the cell wall controls what enters, mp2 is lost (right + wrong = wrong).",
      modelAnswer:
        "The nucleus contains the genetic material and controls the activities of the cell. The cell membrane controls which substances enter and leave the cell.",
    },
  },
  {
    id: "bio-4112-q05",
    subjectId: SUBJECT,
    primarySubTopicId: SUB_TOPIC,
    type: "SHORT",
    tier: "BOTH",
    paper: 1,
    marks: 2,
    commandWord: "Explain",
    ao: "AO2",
    difficulty: 3,
    estSeconds: 120,
    stem: "A muscle cell contains many more mitochondria than a skin cell does.\n\nExplain why.",
    specPoints: [{ code: "bio-4112-func", weight: 1 }],
    markScheme: {
      points: [
        {
          id: "mp1",
          text: "Muscle cells contract, so they need a large amount of energy",
          marks: 1,
          alternatives: ["muscle cells are more active / do more work"],
          reject: ["muscle cells are bigger"],
        },
        {
          id: "mp2",
          text: "Mitochondria are the site of aerobic respiration, which transfers the energy the cell needs",
          marks: 1,
          alternatives: ["more mitochondria means a higher rate of aerobic respiration"],
          reject: [
            "mitochondria are the powerhouse of the cell",
            "mitochondria make energy",
            "mitochondria produce energy",
            "mitochondria create energy",
          ],
        },
      ],
      guidance:
        "mp2 requires aerobic respiration to be named. Energy is transferred, never made or produced — 'makes energy' is rejected however it is phrased, and so is 'powerhouse'.",
      modelAnswer:
        "Muscle cells contract, which requires a lot of energy. Mitochondria are the site of aerobic respiration, the reaction that transfers energy for the cell to use, so a muscle cell needs many of them.",
    },
  },
  {
    id: "bio-4112-q06",
    subjectId: SUBJECT,
    primarySubTopicId: SUB_TOPIC,
    type: "SHORT",
    tier: "BOTH",
    paper: 1,
    marks: 3,
    commandWord: "Explain",
    ao: "AO2",
    difficulty: 3,
    estSeconds: 180,
    stem: "A palisade cell from a leaf contains many chloroplasts. A root hair cell from the same plant contains none.\n\nExplain why.",
    specPoints: [
      { code: "bio-4112-plant", weight: 0.5 },
      { code: "bio-4112-func", weight: 1 },
    ],
    markScheme: {
      points: [
        {
          id: "mp1",
          text: "Chloroplasts are the site of photosynthesis / contain chlorophyll, which absorbs light",
          marks: 1,
          alternatives: [],
          reject: ["chlorophyll is the site of photosynthesis"],
        },
        {
          id: "mp2",
          text: "Palisade cells are near the top of the leaf and receive a lot of light, so they photosynthesise rapidly",
          marks: 1,
          alternatives: ["leaves are exposed to light"],
          reject: [],
        },
        {
          id: "mp3",
          text: "Roots are underground and receive no light, so chloroplasts would be of no use to a root hair cell",
          marks: 1,
          alternatives: ["photosynthesis cannot happen without light"],
          reject: [],
        },
      ],
      guidance:
        "This is why the specification says plant cells *often* have chloroplasts. An answer that asserts all plant cells have chloroplasts contradicts the stem and cannot score mp3.",
      modelAnswer:
        "Chloroplasts contain chlorophyll, which absorbs light for photosynthesis. Palisade cells are near the upper surface of the leaf where they receive a lot of light, so they photosynthesise rapidly and need many chloroplasts. A root hair cell is underground and receives no light, so chloroplasts would be of no use to it.",
    },
  },
  {
    id: "bio-4112-q07",
    subjectId: SUBJECT,
    primarySubTopicId: SUB_TOPIC,
    type: "DATA_RESPONSE",
    tier: "BOTH",
    paper: 1,
    marks: 3,
    commandWord: "Estimate",
    ao: "AO2",
    difficulty: 3,
    estSeconds: 180,
    stem: "Three students looked at the same slide of onion epidermal cells. Each counted how many cells fitted end to end along a scale bar 300 µm long. Their counts are shown in **Table 1**.\n\nEstimate the mean length of one onion cell. Give your answer in µm.",
    assets: {
      figureCaption: "Table 1 — number of cells counted along a 300 µm scale bar",
      dataTable: {
        headers: ["Student", "Number of cells along the scale bar"],
        rows: [
          ["A", "5"],
          ["B", "6"],
          ["C", "4"],
        ],
      },
    },
    specPoints: [{ code: "bio-4112-est", weight: 1 }],
    markScheme: {
      points: [
        {
          id: "mp1",
          text: "Mean number of cells = (5 + 6 + 4) ÷ 3 = 5",
          marks: 1,
          alternatives: [],
          reject: [],
        },
        {
          id: "mp2",
          text: "Divides the length of the scale bar by the number of cells: 300 ÷ 5",
          marks: 1,
          alternatives: ["300 ÷ (mean count)"],
          reject: ["300 × 5"],
        },
        {
          id: "mp3",
          text: "60 µm (accept 50–75 µm)",
          marks: 1,
          alternatives: [],
          reject: ["an answer with no unit", "an answer in mm or nm"],
        },
      ],
      guidance:
        "Method marks mp1 and mp2 are awarded from the working even if the final value is outside the accepted range. Error carried forward applies to mp3.",
      ecfRules:
        "If the mean in mp1 is wrong but 300 is then correctly divided by it, award mp2 and award mp3 for the value that follows from their mean.",
      numericAnswer: {
        accept: { min: 50, max: 75 },
        unit: "µm",
        methodPointIds: ["mp1", "mp2"],
        ecf: true,
      },
      modelAnswer:
        "The mean count is (5 + 6 + 4) ÷ 3 = 5 cells along the 300 µm bar. One cell is therefore about 300 ÷ 5 = 60 µm long.",
    },
  },
  {
    id: "bio-4112-q08",
    subjectId: SUBJECT,
    primarySubTopicId: SUB_TOPIC,
    type: "SHORT",
    tier: "BOTH",
    paper: 1,
    marks: 2,
    commandWord: "Estimate",
    ao: "AO2",
    difficulty: 2,
    estSeconds: 120,
    stem: "An animal cell is 20 µm wide. Under the microscope its nucleus appears to be about one quarter of the width of the cell.\n\nEstimate the diameter of the nucleus. Give your answer in µm.",
    specPoints: [{ code: "bio-4112-est", weight: 1 }],
    markScheme: {
      points: [
        {
          id: "mp1",
          text: "Takes one quarter of the cell width: 20 ÷ 4 (or 0.25 × 20)",
          marks: 1,
          alternatives: [],
          reject: ["20 × 4"],
        },
        {
          id: "mp2",
          text: "5 µm (accept 4–6 µm)",
          marks: 1,
          alternatives: [],
          reject: ["an answer with no unit"],
        },
      ],
      guidance:
        "The method mark stands on its own: a student who writes 20 ÷ 4 and then miscalculates still earns mp1. A value of about 5 µm is consistent with the 5–10 µm range students are expected to know for a nucleus.",
      numericAnswer: {
        accept: { min: 4, max: 6 },
        unit: "µm",
        methodPointIds: ["mp1"],
        ecf: true,
      },
      modelAnswer: "One quarter of 20 µm is 20 ÷ 4 = 5 µm.",
    },
  },
  {
    id: "bio-4112-q09",
    subjectId: SUBJECT,
    primarySubTopicId: SUB_TOPIC,
    type: "DATA_RESPONSE",
    tier: "BOTH",
    paper: 1,
    marks: 2,
    commandWord: "Estimate",
    ao: "AO2",
    difficulty: 4,
    estSeconds: 150,
    stem: "A student looked at a plant cell that was approximately rectangular. Their measurements and count are shown in **Table 2**.\n\nEstimate the area of one nucleus. Give your answer in µm².",
    assets: {
      figureCaption: "Table 2 — a student's measurements of one plant cell",
      dataTable: {
        headers: ["Measurement", "Value"],
        rows: [
          ["Length of the cell", "30 µm"],
          ["Width of the cell", "15 µm"],
          ["Number of nuclei that would fit inside the cell outline", "18"],
        ],
      },
    },
    specPoints: [{ code: "bio-4112-est", weight: 1 }],
    markScheme: {
      points: [
        {
          id: "mp1",
          text: "Area of the cell = 30 × 15 = 450 µm²",
          marks: 1,
          alternatives: [],
          reject: ["30 + 15", "an area given in µm"],
        },
        {
          id: "mp2",
          text: "450 ÷ 18 = 25 µm² (accept 22–28 µm²)",
          marks: 1,
          alternatives: [],
          reject: ["an answer with no unit", "an answer in µm rather than µm²"],
        },
      ],
      guidance:
        "The unit is marked. An area in µm rather than µm² does not score mp2. Error carried forward applies: a wrong cell area divided correctly by 18 still earns mp2.",
      ecfRules: "Award mp2 for (their mp1 area) ÷ 18 correctly evaluated and given in µm².",
      numericAnswer: {
        accept: { min: 22, max: 28 },
        unit: "µm²",
        methodPointIds: ["mp1"],
        ecf: true,
      },
      modelAnswer:
        "The area of the cell is 30 × 15 = 450 µm². Eighteen nuclei fit inside it, so one nucleus has an area of about 450 ÷ 18 = 25 µm².",
    },
  },
  {
    id: "bio-4112-q10",
    subjectId: SUBJECT,
    primarySubTopicId: SUB_TOPIC,
    type: "SHORT",
    tier: "BOTH",
    paper: 1,
    marks: 3,
    commandWord: "Explain",
    ao: "AO2",
    difficulty: 4,
    estSeconds: 180,
    stem: "A gland cell makes and releases large amounts of an enzyme.\n\nExplain which **two** sub-cellular structures you would expect this cell to contain in unusually large numbers.",
    specPoints: [{ code: "bio-4112-func", weight: 1 }],
    markScheme: {
      points: [
        {
          id: "mp1",
          text: "Ribosomes, because they are the site of protein synthesis and enzymes are proteins",
          marks: 1,
          alternatives: [],
          reject: ["ribosomes make energy"],
        },
        {
          id: "mp2",
          text: "Mitochondria",
          marks: 1,
          alternatives: [],
          reject: [],
        },
        {
          id: "mp3",
          text: "Because protein synthesis requires energy, which is transferred by aerobic respiration in the mitochondria",
          marks: 1,
          alternatives: [
            "making and releasing the enzyme is an active process that needs energy",
          ],
          reject: [
            "mitochondria are the powerhouse",
            "mitochondria make energy",
            "mitochondria produce energy",
          ],
        },
      ],
      guidance:
        "mp1 requires the link enzyme → protein → ribosome; naming ribosomes alone does not score. mp3 is only available if mitochondria have been named in mp2.",
      modelAnswer:
        "Ribosomes, because enzymes are proteins and ribosomes are the site of protein synthesis. Mitochondria, because protein synthesis requires energy and mitochondria are the site of aerobic respiration, which transfers that energy.",
    },
  },
  {
    id: "bio-4112-q11",
    subjectId: SUBJECT,
    primarySubTopicId: SUB_TOPIC,
    type: "SHORT",
    tier: "BOTH",
    paper: 1,
    marks: 3,
    commandWord: "Compare",
    ao: "AO1",
    difficulty: 3,
    estSeconds: 180,
    stem: "Compare the structure of a typical animal cell and a typical plant cell.",
    specPoints: [
      { code: "bio-4112-animal", weight: 1 },
      { code: "bio-4112-plant", weight: 1 },
    ],
    markScheme: {
      points: [
        {
          id: "mp1",
          text: "Both have a nucleus, cytoplasm, a cell membrane, mitochondria and ribosomes",
          marks: 1,
          alternatives: ["both have a nucleus and cytoplasm and a cell membrane"],
          reject: [],
        },
        {
          id: "mp2",
          text: "A plant cell has a cellulose cell wall whereas an animal cell does not",
          marks: 1,
          alternatives: [],
          reject: [
            "animal cells have a cell wall",
            "a plant cell has a cell wall (with no reference to the animal cell)",
          ],
        },
        {
          id: "mp3",
          text: "A plant cell often has chloroplasts and a permanent vacuole whereas an animal cell has neither",
          marks: 1,
          alternatives: ["a plant cell often has chloroplasts whereas an animal cell has none"],
          reject: [
            "all plant cells have chloroplasts",
            "a plant cell has chloroplasts (with no reference to the animal cell)",
          ],
        },
      ],
      guidance:
        "**A comparison must compare.** Each mark requires a paired statement covering both cell types, joined by 'whereas', 'but' or an equivalent. A list of the features of a plant cell alone scores **zero**, however correct it is. Accept a clearly laid out two-column table as paired statements.",
      modelAnswer:
        "Both cells have a nucleus, cytoplasm, a cell membrane, mitochondria and ribosomes. A plant cell has a cellulose cell wall whereas an animal cell does not. A plant cell often has chloroplasts and a permanent vacuole filled with cell sap, whereas an animal cell has neither.",
    },
  },
  {
    id: "bio-4112-q12",
    subjectId: SUBJECT,
    primarySubTopicId: SUB_TOPIC,
    type: "EXTENDED",
    tier: "BOTH",
    paper: 1,
    marks: 6,
    commandWord: "Evaluate",
    ao: "AO3",
    difficulty: 5,
    estSeconds: 420,
    stem: "A student examined two unknown cells under a light microscope and recorded what they could see.\n\n- **Cell X** had a nucleus, cytoplasm, a cell membrane and mitochondria.\n- **Cell Y** had all of these, and also a cell wall and a large permanent vacuole, but no chloroplasts.\n\nThe student concluded that Cell X is an animal cell and Cell Y is a plant cell.\n\nEvaluate the student's conclusion.",
    specPoints: [
      { code: "bio-4112-animal", weight: 1 },
      { code: "bio-4112-plant", weight: 1 },
      { code: "bio-4112-func", weight: 0.5 },
    ],
    markScheme: {
      points: [
        {
          id: "mp1",
          text: "Cell X has the structures found in most animal cells, so the conclusion is consistent with the observations",
          marks: 1,
          alternatives: [],
          reject: [],
        },
        {
          id: "mp2",
          text: "However, all of those structures are also found in plant cells, so the observations do not rule out Cell X being a plant cell",
          marks: 1,
          alternatives: [
            "the evidence for Cell X is not conclusive because plant cells share all of these structures",
          ],
          reject: [],
        },
        {
          id: "mp3",
          text: "The cell wall and the permanent vacuole are found in plant cells and not in animal cells, so these support the conclusion that Cell Y is a plant cell",
          marks: 1,
          alternatives: [],
          reject: [],
        },
        {
          id: "mp4",
          text: "The absence of chloroplasts does not contradict this, because plant cells only *often* have chloroplasts",
          marks: 1,
          alternatives: [],
          reject: ["all plant cells have chloroplasts, so Cell Y cannot be a plant cell"],
        },
        {
          id: "mp5",
          text: "A named or described example: a root hair cell is a plant cell with no chloroplasts, because it receives no light",
          marks: 1,
          alternatives: ["cells that are not exposed to light have no chloroplasts"],
          reject: [],
        },
        {
          id: "mp6",
          text: "Overall judgement: the conclusion about Cell Y is well supported, but the conclusion about Cell X is not certain from this evidence alone",
          marks: 1,
          alternatives: [
            "further evidence, such as looking for a cell wall around Cell X, would be needed to be sure",
          ],
          reject: [],
        },
      ],
      guidance:
        "This question is marked by mark points, not by levels. mp6 requires a judgement that distinguishes the two cells — an answer that simply agrees or disagrees with the student overall does not score it. Ribosomes are not mentioned in the stem because they cannot be seen with a light microscope; do not require them.",
      modelAnswer:
        "Cell X shows the nucleus, cytoplasm, cell membrane and mitochondria found in most animal cells, so the conclusion is consistent with what was seen. However, plant cells also have all four of these structures, so the observations do not actually rule out Cell X being a plant cell — nothing was seen that only an animal cell has. Cell Y is more convincing: a cell wall and a large permanent vacuole are found in plant cells and not in animal cells. The lack of chloroplasts does not undermine this, because plant cells only often have chloroplasts — a root hair cell has none, since it is underground and receives no light. Overall, the conclusion about Cell Y is well supported by the evidence, while the conclusion about Cell X is plausible but not certain; the student would need to check for the absence of a cell wall to be confident.",
    },
  },

  // -------------------------------------------------------------------------
  // Required practical 1 — 5 questions, 14 marks (31% of the bank)
  // -------------------------------------------------------------------------
  {
    id: "bio-4112-q13",
    subjectId: SUBJECT,
    primarySubTopicId: SUB_TOPIC,
    type: "PRACTICAL",
    tier: "BOTH",
    paper: 1,
    marks: 4,
    commandWord: "Describe",
    ao: "AO1",
    difficulty: 3,
    estSeconds: 300,
    practicalId: "bio-rp-1",
    stem: "A student is going to look at onion epidermal cells using a light microscope.\n\nDescribe how the student should prepare the slide.",
    specPoints: [{ code: "bio-rp-1", weight: 1 }],
    markScheme: {
      points: [
        {
          id: "mp1",
          text: "Place a drop of water in the middle of a clean microscope slide",
          marks: 1,
          alternatives: [],
          reject: ["place the specimen on a dry slide"],
        },
        {
          id: "mp2",
          text: "Peel a thin layer of epidermis from the inner surface of the onion and lay it flat on the drop of water",
          marks: 1,
          alternatives: ["use forceps to peel a single layer of cells and unfold it"],
          reject: ["cut a thick piece of onion", "peel from the outer surface"],
        },
        {
          id: "mp3",
          text: "Add two drops of iodine solution",
          marks: 1,
          alternatives: ["add a stain / iodine solution"],
          reject: [],
        },
        {
          id: "mp4",
          text: "Lower a coverslip onto the specimen using a mounted needle",
          marks: 1,
          alternatives: ["stand the coverslip on one edge and lower it slowly"],
          reject: ["drop the coverslip flat onto the specimen", "place the coverslip on top"],
        },
      ],
      guidance:
        "Four marks from the steps above. Blotting away excess liquid and wearing eye protection are creditworthy in a longer answer but are not required here. Steps given out of order still score, provided the water precedes the specimen.",
      modelAnswer:
        "Put on eye protection. Place a drop of water in the middle of a clean slide. Use forceps to peel a thin layer of epidermis from the inner surface of a piece of onion, and lay it flat on the water without folding it. Add two drops of iodine solution. Stand a coverslip on one edge next to the specimen and use a mounted needle to lower it slowly onto the slide, then blot away any excess liquid.",
    },
  },
  {
    id: "bio-4112-q14",
    subjectId: SUBJECT,
    primarySubTopicId: SUB_TOPIC,
    type: "PRACTICAL",
    tier: "BOTH",
    paper: 1,
    marks: 2,
    commandWord: "Explain",
    ao: "AO1",
    difficulty: 3,
    estSeconds: 120,
    practicalId: "bio-rp-1",
    stem: "When preparing the slide, the coverslip should be lowered onto the specimen using a mounted needle rather than dropped flat onto it.\n\nExplain why.",
    specPoints: [{ code: "bio-rp-1", weight: 1 }],
    markScheme: {
      points: [
        {
          id: "mp1",
          text: "Lowering the coverslip slowly from one edge pushes the air out ahead of it",
          marks: 1,
          alternatives: [],
          reject: [],
        },
        {
          id: "mp2",
          text: "So air bubbles are not trapped under the coverslip, which would obscure the cells or be mistaken for cells",
          marks: 1,
          alternatives: ["bubbles block the view of the specimen"],
          reject: ["to stop the coverslip breaking (alone)"],
        },
      ],
      guidance:
        "mp2 needs the consequence, not just the word 'bubbles'. Accept either 'obscures the cells' or 'is mistaken for a cell' — air bubbles are round with a thick dark rim, which is exactly why students draw them as cells.",
      modelAnswer:
        "Standing the coverslip on one edge and lowering it slowly with a mounted needle pushes the air out ahead of it, so no air bubbles are trapped underneath. Trapped bubbles sit over the specimen and obscure the cells, and because they are round with a dark outline they are easily mistaken for cells.",
    },
  },
  {
    id: "bio-4112-q15",
    subjectId: SUBJECT,
    primarySubTopicId: SUB_TOPIC,
    type: "PRACTICAL",
    tier: "BOTH",
    paper: 1,
    marks: 2,
    commandWord: "Explain",
    ao: "AO1",
    difficulty: 2,
    estSeconds: 120,
    practicalId: "bio-rp-1",
    stem: "Explain why iodine solution is added to the slide.",
    specPoints: [{ code: "bio-rp-1", weight: 1 }],
    markScheme: {
      points: [
        {
          id: "mp1",
          text: "It stains the cells / the sub-cellular structures",
          marks: 1,
          alternatives: ["it colours the cell contents"],
          reject: [],
        },
        {
          id: "mp2",
          text: "This increases the contrast, so structures such as the nuclei and cell walls can be seen",
          marks: 1,
          alternatives: [
            "without it the cells are transparent and cannot be distinguished from the background",
          ],
          reject: [
            "it makes the cells bigger",
            "it magnifies the cells",
            "it kills the cells so they stop moving",
          ],
        },
      ],
      guidance:
        "Misconception 10: staining does not change the size or structure of the cells, only how visible they are. Reject any answer that claims the stain enlarges or alters them.",
      modelAnswer:
        "Iodine solution stains the cell contents. This increases the contrast between the sub-cellular structures and the background, so features such as the nuclei and the cell walls become visible — without it the cells are almost transparent.",
    },
  },
  {
    id: "bio-4112-q16",
    subjectId: SUBJECT,
    primarySubTopicId: SUB_TOPIC,
    type: "PRACTICAL",
    tier: "BOTH",
    paper: 1,
    marks: 3,
    commandWord: "Suggest",
    ao: "AO3",
    difficulty: 4,
    estSeconds: 210,
    practicalId: "bio-rp-1",
    stem: "A student puts their prepared slide on the microscope stage, immediately selects the ×40 objective lens, and looks down the eyepiece. They see a dark, empty field of view and no cells at all.\n\nSuggest **two** reasons for what the student sees, and describe what they should do.",
    specPoints: [{ code: "bio-rp-1", weight: 1 }],
    markScheme: {
      points: [
        {
          id: "mp1",
          text: "At high magnification the field of view is very small, so only a tiny area of the slide is visible and the cells are unlikely to be in it",
          marks: 1,
          alternatives: [
            "there is nothing to aim at because so little of the slide can be seen",
          ],
          reject: [],
        },
        {
          id: "mp2",
          text: "A second valid reason: the slide is far from being in focus, or less light reaches the eyepiece at high power, or too much stain has made the specimen opaque",
          marks: 1,
          alternatives: [
            "the specimen has not been focused yet",
            "the iris is closed too far so the image is dark",
          ],
          reject: [],
        },
        {
          id: "mp3",
          text: "They should start with the lowest power objective, find and focus the cells and move them to the centre of the field of view, then switch to a higher power and refocus with the fine adjustment",
          marks: 1,
          alternatives: [
            "go back to the ×4 objective, focus, centre the cells, then increase the magnification",
          ],
          reject: ["turn the coarse focus while looking down the eyepiece"],
        },
      ],
      guidance:
        "Two distinct reasons are required for mp1 and mp2; repeating the same idea in different words scores once. mp3 must include starting at low power — 'keep adjusting the focus' does not score.",
      modelAnswer:
        "At ×400 the field of view is very small, so only a tiny part of the slide can be seen and the cells are very unlikely to be within it. The specimen is also not yet in focus, and less light passes through at high power, so the field looks dark. The student should return to the lowest power objective, bring the cells into focus and move them to the centre of the field of view, and only then switch to a higher power lens and refocus using the fine adjustment.",
    },
  },
  {
    id: "bio-4112-q17",
    subjectId: SUBJECT,
    primarySubTopicId: SUB_TOPIC,
    type: "CALCULATION",
    tier: "BOTH",
    paper: 1,
    marks: 3,
    commandWord: "Calculate",
    ao: "AO2",
    difficulty: 4,
    estSeconds: 240,
    practicalId: "bio-rp-1",
    stem: "A student views onion cells using a ×10 eyepiece lens and a ×40 objective lens. At this magnification, one eyepiece graticule division is equal to 2.67 µm.\n\nOne cell measures **90 graticule divisions** in length.\n\nThe student's drawing of that cell is **120 mm** long.\n\nCalculate the magnification of the student's drawing.",
    specPoints: [
      { code: "bio-rp-1", weight: 1 },
      { code: "bio-4112-est", weight: 0.5 },
    ],
    markScheme: {
      points: [
        {
          id: "mp1",
          text: "Actual length of the cell = 90 × 2.67 = 240 µm",
          marks: 1,
          alternatives: ["240.3 µm"],
          reject: ["90 ÷ 2.67"],
        },
        {
          id: "mp2",
          text: "Converts so both lengths are in the same unit: 240 µm = 0.24 mm, or 120 mm = 120 000 µm",
          marks: 1,
          alternatives: [],
          reject: ["dividing 120 mm by 240 µm without converting"],
        },
        {
          id: "mp3",
          text: "Magnification = 120 ÷ 0.24 = ×500 (accept 480–515)",
          marks: 1,
          alternatives: ["120 000 ÷ 240 = 500"],
          reject: ["×400", "an answer given with a unit such as µm"],
        },
      ],
      guidance:
        "Misconception 9: ×400 is the magnification of the **microscope**, not of the drawing, and is rejected. Magnification is a ratio of two lengths and therefore has no unit — an answer written as '500 µm' does not score mp3. Error carried forward applies through both steps.",
      ecfRules:
        "If mp1 is wrong, award mp2 for a correct unit conversion of their value and mp3 for 120 ÷ (their length in mm) correctly evaluated.",
      numericAnswer: {
        accept: { min: 480, max: 515 },
        methodPointIds: ["mp1", "mp2"],
        ecf: true,
      },
      modelAnswer:
        "The actual length of the cell is 90 × 2.67 = 240 µm. There are 1000 µm in a millimetre, so 240 µm = 0.24 mm. The magnification of the drawing is the length of the drawing divided by the actual length: 120 ÷ 0.24 = ×500. Magnification has no unit because it is a ratio of two lengths.",
    },
  },
];
