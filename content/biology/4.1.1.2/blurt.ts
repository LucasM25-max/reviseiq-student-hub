/**
 * Blurt prompts — 4.1.1.2 Animal and plant cells.
 *
 * A blurt is a free recall exercise: the student writes everything they can remember,
 * then the answer is checked against `expectedPoints`. `aliases` exist so that recall is
 * marked on the idea rather than the exact wording, and `essential` marks the points a
 * student really should not have missed.
 */
import type { BlurtPromptInput } from "@/lib/content/schema";

export const blurtPrompts: BlurtPromptInput[] = [
  {
    id: "bio-4112-b1",
    subTopicId: "aqa-biology-4.1.1",
    prompt: "Write down every part of an animal cell you can remember, and what each one does.",
    tier: "BOTH",
    estMinutes: 4,
    expectedPoints: [
      {
        id: "ep1",
        idea: "Nucleus — contains the genetic material and controls the activities of the cell",
        aliases: ["nucleus", "DNA", "chromosomes"],
        essential: true,
      },
      {
        id: "ep2",
        idea: "Cytoplasm — where most of the chemical reactions take place",
        aliases: ["cytoplasm"],
        essential: true,
      },
      {
        id: "ep3",
        idea: "Cell membrane — controls what enters and leaves the cell",
        aliases: ["cell membrane", "membrane"],
        essential: true,
      },
      {
        id: "ep4",
        idea: "Mitochondria — the site of aerobic respiration",
        aliases: ["mitochondria", "mitochondrion"],
        essential: true,
      },
      {
        id: "ep5",
        idea: "Ribosomes — the site of protein synthesis",
        aliases: ["ribosomes", "ribosome"],
        essential: true,
      },
    ],
  },
  {
    id: "bio-4112-b2",
    subTopicId: "aqa-biology-4.1.1",
    prompt:
      "What do plant and algal cells have that animal cells do not? For each one, say what it is for.",
    tier: "BOTH",
    estMinutes: 4,
    expectedPoints: [
      {
        id: "ep1",
        idea: "Cell wall, made of cellulose — strengthens the cell",
        aliases: ["cell wall", "cellulose"],
        essential: true,
      },
      {
        id: "ep2",
        idea: "The cell wall belongs to plant and algal cells, not plants alone",
        aliases: ["algae", "algal"],
        essential: false,
      },
      {
        id: "ep3",
        idea: "Chloroplasts — the site of photosynthesis; contain chlorophyll, which absorbs light",
        aliases: ["chloroplast", "photosynthesis"],
        essential: true,
      },
      {
        id: "ep4",
        idea: "Plant cells only often have chloroplasts — cells that receive no light, such as root hair cells, have none",
        aliases: ["often", "root hair"],
        essential: false,
      },
      {
        id: "ep5",
        idea: "Permanent vacuole, filled with cell sap — helps keep the cell firm",
        aliases: ["vacuole", "cell sap"],
        essential: true,
      },
    ],
  },
  {
    id: "bio-4112-b3",
    subTopicId: "aqa-biology-4.1.1",
    prompt:
      "Describe the whole method for preparing and viewing a slide of onion epidermal cells, from start to finish.",
    tier: "BOTH",
    estMinutes: 6,
    expectedPoints: [
      {
        id: "ep1",
        idea: "Put on eye protection before handling iodine solution",
        aliases: ["goggles", "eye protection"],
        essential: false,
      },
      {
        id: "ep2",
        idea: "Place a drop of water on a clean slide",
        aliases: ["drop of water"],
        essential: true,
      },
      {
        id: "ep3",
        idea: "Peel a thin layer of epidermis from the inner surface of the onion",
        aliases: ["epidermis", "inner surface", "thin layer"],
        essential: true,
      },
      {
        id: "ep4",
        idea: "Lay the layer flat on the water, without folds",
        aliases: ["flat", "unfold", "forceps"],
        essential: true,
      },
      {
        id: "ep5",
        idea: "Add two drops of iodine solution to stain the cells",
        aliases: ["iodine", "stain"],
        essential: true,
      },
      {
        id: "ep6",
        idea: "Lower the coverslip from one edge with a mounted needle",
        aliases: ["coverslip", "mounted needle"],
        essential: true,
      },
      {
        id: "ep7",
        idea: "Start with the lowest power objective, and rack the lens down while looking from the side",
        aliases: ["lowest power", "from the side"],
        essential: true,
      },
      {
        id: "ep8",
        idea: "Focus by increasing the distance between the lens and the slide, then switch to higher power and use the fine focus only",
        aliases: ["fine focus", "fine adjustment"],
        essential: true,
      },
    ],
  },
  {
    id: "bio-4112-b4",
    subTopicId: "aqa-biology-4.1.1",
    prompt:
      "List everything that can go wrong when preparing and viewing a slide, and say why each one happens.",
    tier: "BOTH",
    estMinutes: 5,
    expectedPoints: [
      {
        id: "ep1",
        idea: "Air bubbles, from dropping the coverslip flat instead of lowering it from one edge",
        aliases: ["air bubbles", "bubbles"],
        essential: true,
      },
      {
        id: "ep2",
        idea: "No contrast and invisible nuclei, from using no stain",
        aliases: ["no stain", "no iodine", "contrast"],
        essential: true,
      },
      {
        id: "ep3",
        idea: "An opaque, unreadable specimen, from using too much stain",
        aliases: ["too much stain", "over stained", "opaque"],
        essential: false,
      },
      {
        id: "ep4",
        idea: "Cells at several depths that will not all focus, from a specimen that is too thick or folded",
        aliases: ["too thick", "folded", "focal plane"],
        essential: true,
      },
      {
        id: "ep5",
        idea: "Shrivelled cells, from mounting the specimen dry with no water",
        aliases: ["dry", "no water", "shrivelled"],
        essential: false,
      },
      {
        id: "ep6",
        idea: "A cracked slide, from racking the lens down while looking through the eyepiece",
        aliases: ["cracked", "broken slide", "eyepiece"],
        essential: true,
      },
      {
        id: "ep7",
        idea: "A dark empty field, from starting on a high power objective instead of the lowest",
        aliases: ["high power", "empty field", "lost"],
        essential: true,
      },
    ],
  },
];
